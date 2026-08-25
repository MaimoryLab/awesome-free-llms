"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type MeasuredBenefit = { type: "token" | "voucher" | "points"; amount: number; unit?: string };
type Benefit = MeasuredBenefit | { type: "token-plan"; planName: string; validDays: number } | { type: "other"; description: string };
type Offer = {
  id: string;
  providerName: string;
  officialUrl: string;
  benefits: Benefit[];
  requiresInvite: boolean;
  requiresNewAccount: boolean;
  inviteCode?: string | null;
  claimUrl?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isLongTerm: boolean;
  notes?: string | null;
  models?: string[] | null;
  createdAt: string;
};
type Pagination = { page: number; pageSize: number; total: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
type Kind = "active" | "long-term";

const PAGE_SIZE = 12;
const tabs: { kind: Kind; label: string; eyebrow: string }[] = [
  { kind: "active", label: "有效期活动", eyebrow: "限时福利" },
  { kind: "long-term", label: "长期活动", eyebrow: "持续可用" },
];
const benefitLabels: Record<MeasuredBenefit["type"], string> = { token: "Token", voucher: "代金券", points: "积分" };
const benefitUnitLabels: Record<string, string> = { "token:": "百万 Token", "token:million-token": "百万 Token", "voucher:USD": "美元代金券", "voucher:CNY": "人民币代金券" };
const formatAmount = (amount: number) => new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(amount);
const formatDate = (value?: string | null) => {
  if (!value) return "未注明";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "未注明" : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(date);
};

async function fetchOffers(kind: Kind, page: number, signal: AbortSignal) {
  const response = await fetch(`/api/offers?kind=${kind}&page=${page}&pageSize=${PAGE_SIZE}`, { signal, cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || "暂时无法加载活动");
  return payload as { items: Offer[]; pagination: Pagination };
}

function OfferCard({ offer }: { offer: Offer }) {
  const hostname = useMemo(() => { try { return new URL(offer.officialUrl).hostname.replace(/^www\./, ""); } catch { return offer.officialUrl; } }, [offer.officialUrl]);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
  return (
    <article className="offer-card">
      <div className="offer-card__topline">
        <span className="offer-card__mark" aria-hidden="true"><span>{offer.providerName.slice(0, 1).toUpperCase()}</span><Image src={faviconUrl} alt="" width={24} height={24} unoptimized onError={(event) => { event.currentTarget.hidden = true; }} /></span>
        <div className="offer-card__provider"><h2>{offer.providerName}</h2><a href={offer.officialUrl} target="_blank" rel="noreferrer noopener">{hostname} <span aria-hidden="true">↗</span></a></div>
        <time className="offer-card__date" dateTime={offer.createdAt}>{formatDate(offer.createdAt)}</time>
      </div>
      <div className="benefit-list" aria-label="免费额度">{offer.benefits.map((benefit, index) => <BenefitBadge benefit={benefit} key={`${benefit.type}-${index}`} />)}</div>
      <dl className="offer-meta"><div><dt>活动时间</dt><dd>{offer.isLongTerm ? "长期有效" : `${formatDate(offer.startsAt)} - ${formatDate(offer.endsAt)}`}</dd></div><div><dt>账号要求</dt><dd>{offer.requiresNewAccount ? "需要新注册" : "现有账号可用"}</dd></div><div><dt>领取方式</dt><dd>{offer.requiresInvite ? "需要邀请码" : "直接可用"}</dd></div></dl>
      {offer.models && offer.models.length > 0 && <div className="model-row"><span className="field-label">可用模型</span><div className="model-tags">{offer.models.map((model) => <span key={model}>{model}</span>)}</div></div>}
      {offer.requiresInvite && offer.inviteCode && <div className="invite-row"><span>邀请码</span><code>{offer.inviteCode}</code></div>}
      {offer.notes && <p className="offer-notes">{offer.notes}</p>}
      <div className="offer-actions">{offer.claimUrl ? <a className="button button--primary" href={offer.claimUrl} target="_blank" rel="noreferrer noopener">一键领取 <span aria-hidden="true">↗</span></a> : <a className="button button--secondary" href={offer.officialUrl} target="_blank" rel="noreferrer noopener">前往官网 <span aria-hidden="true">↗</span></a>}</div>
    </article>
  );
}

function BenefitBadge({ benefit }: { benefit: Benefit }) {
  if (benefit.type === "token-plan") return <span className="benefit benefit--token-plan"><strong>{benefit.planName}</strong> Token Plan · {benefit.validDays} 天</span>;
  if (benefit.type === "other") return <span className="benefit benefit--other"><strong>其他</strong> {benefit.description}</span>;
  return <span className={`benefit benefit--${benefit.type}`}><strong>{formatAmount(benefit.amount)}</strong> {benefitUnitLabels[`${benefit.type}:${benefit.unit ?? ""}`] || benefitLabels[benefit.type]}</span>;
}

export default function Home() {
  const [kind, setKind] = useState<Kind>("active");
  const [pages, setPages] = useState<Record<Kind, number>>({ active: 1, "long-term": 1 });
  const [results, setResults] = useState<Record<Kind, Offer[]>>({ active: [], "long-term": [] });
  const [pagination, setPagination] = useState<Record<Kind, Pagination | null>>({ active: null, "long-term": null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchOffers("active", pages.active, controller.signal),
      fetchOffers("long-term", pages["long-term"], controller.signal),
    ])
      .then(([active, longTerm]) => {
        setResults({ active: active.items || [], "long-term": longTerm.items || [] });
        setPagination({ active: active.pagination || null, "long-term": longTerm.pagination || null });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "暂时无法加载活动");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [pages, reload]);
  const currentOffers = results[kind];
  const currentPagination = pagination[kind];
  const currentTab = tabs.find((tab) => tab.kind === kind) || tabs[0];
  const selectKind = (nextKind: Kind) => {
    if (nextKind === kind) return;
    setError(null);
    setKind(nextKind);
  };
  const changePage = (page: number) => {
    setLoading(true);
    setError(null);
    setPages((current) => ({ ...current, [kind]: page }));
  };
  return (
    <main className="site-shell" id="main-content">
      <a className="skip-link" href="#catalog">跳到活动列表</a>
      <header className="site-header"><Link className="brand" href="/" aria-label="Free LLM Hub 首页"><span className="brand__dot" />Free LLM Hub</Link><nav><Link className="header-link" href="/submit">提交线索 <span aria-hidden="true">＋</span></Link></nav></header>
      <section className="hero" aria-labelledby="page-title"><div className="hero__copy"><p className="kicker">FREE LLM OFFERS, CURATED</p><h1 id="page-title">免费 LLM<br /><em>活动与额度</em></h1><p className="hero__lede">汇总各家模型服务的免费额度、代金券和长期计划。信息清楚，入口直接，按需领取。</p></div></section>
      <section className="catalog" id="catalog" aria-label="免费活动目录">
        <div className="catalog__header"><div className="tabs" aria-label="活动类型">{tabs.map((tab) => <button key={tab.kind} className={`tab ${kind === tab.kind ? "is-active" : ""}`} aria-controls="offer-panel" aria-pressed={kind === tab.kind} onClick={() => selectKind(tab.kind)}><span className="tab__copy"><span className="tab__eyebrow">{tab.eyebrow}</span>{tab.label}</span><span className="tab__count" aria-label={`${pagination[tab.kind]?.total ?? "加载中"} 条线索`}>{pagination[tab.kind]?.total ?? "—"}</span></button>)}</div><Link className="submit-link" href="/submit">分享一条线索 <span aria-hidden="true">↗</span></Link></div>
        <div className="catalog__intro"><div><p className="section-kicker">{currentTab.eyebrow}</p><h2>{currentTab.label}</h2></div><p>按创建时间从新到旧排列</p></div>
        <div id="offer-panel">{loading ? <div className="state-panel" role="status"><span className="spinner" />正在同步最新活动…</div> : error ? <div className="state-panel state-panel--error" role="alert"><p>{error}</p><button className="button button--secondary" onClick={() => { setLoading(true); setError(null); setReload((value) => value + 1); }}>重新加载</button></div> : currentOffers.length === 0 ? <div className="state-panel"><strong>这里还没有活动</strong><p>成为第一个分享免费额度的人吧。</p><Link className="button button--primary" href="/submit">提交线索</Link></div> : <div className="offer-grid">{currentOffers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div>}</div>
        {!loading && !error && currentPagination && currentPagination.totalPages > 1 && <div className="pagination" aria-label="分页"><button className="page-button" disabled={!currentPagination.hasPreviousPage} onClick={() => changePage(Math.max(1, pages[kind] - 1))} aria-label="上一页">←</button><span>第 {currentPagination.page} / {currentPagination.totalPages} 页</span><button className="page-button" disabled={!currentPagination.hasNextPage} onClick={() => changePage(pages[kind] + 1)} aria-label="下一页">→</button></div>}
      </section>
      <footer className="site-footer"><span>Free LLM Hub · 更新每一份开放机会</span><Link href="/submit">提交新线索 ↗</Link></footer>
    </main>
  );
}
