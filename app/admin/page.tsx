"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AdminOffer = {
  id: string;
  providerName: string;
  officialUrl: string;
  benefits: unknown[];
  requiresInvite: boolean;
  requiresNewAccount: boolean;
  inviteCode: string | null;
  claimUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isLongTerm: boolean;
  notes: string | null;
  models: string[];
  status: "published" | "hidden";
  createdAt: string;
  updatedAt: string;
};

type Editor = Omit<AdminOffer, "benefits" | "models"> & { benefitsJson: string; modelsText: string };

const editorFor = (offer: AdminOffer): Editor => ({
  ...offer,
  benefitsJson: JSON.stringify(offer.benefits, null, 2),
  modelsText: offer.models.join("\n"),
});

async function payload(response: Response) {
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new Error(value?.error?.message || "操作失败");
  return value;
}

export default function AdminPage() {
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await payload(await fetch("/api/admin/offers", { cache: "no-store" }));
      const nextOffers = (result.items || []) as AdminOffer[];
      setOffers(nextOffers);
      setSelectedId((current) => nextOffers.some((offer) => offer.id === current) ? current : nextOffers[0]?.id || "");
      setEditor((current) => current && nextOffers.some((offer) => offer.id === current.id) ? current : nextOffers[0] ? editorFor(nextOffers[0]) : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法加载后台数据");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const select = (offer: AdminOffer) => {
    setSelectedId(offer.id);
    setEditor(editorFor(offer));
    setMessage("");
    setError("");
  };

  const update = <K extends keyof Editor>(key: K, value: Editor[K]) => {
    setEditor((current) => current ? { ...current, [key]: value } : current);
    setMessage("");
  };

  const save = async () => {
    if (!editor) return;
    setSaving(true);
    setError("");
    try {
      let benefits: unknown;
      try { benefits = JSON.parse(editor.benefitsJson); } catch { throw new Error("免费额度必须是有效 JSON"); }
      const result = await payload(await fetch(`/api/admin/offers/${editor.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerName: editor.providerName,
          officialUrl: editor.officialUrl,
          benefits,
          requiresInvite: editor.requiresInvite,
          requiresNewAccount: editor.requiresNewAccount,
          inviteCode: editor.inviteCode || undefined,
          claimUrl: editor.claimUrl || undefined,
          startsAt: editor.startsAt || undefined,
          endsAt: editor.isLongTerm ? undefined : editor.endsAt || undefined,
          isLongTerm: editor.isLongTerm,
          notes: editor.notes || undefined,
          models: editor.modelsText.split("\n").map((model) => model.trim()).filter(Boolean),
          status: editor.status,
        }),
      }));
      const saved = result.item as AdminOffer;
      setOffers((current) => current.map((offer) => offer.id === saved.id ? saved : offer));
      setEditor(editorFor(saved));
      setMessage("已保存");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editor || !window.confirm(`确定删除「${editor.providerName}」吗？此操作不可恢复。`)) return;
    setSaving(true);
    setError("");
    try {
      await payload(await fetch(`/api/admin/offers/${editor.id}`, { method: "DELETE" }));
      const nextOffers = offers.filter((offer) => offer.id !== editor.id);
      setOffers(nextOffers);
      setSelectedId(nextOffers[0]?.id || "");
      setEditor(nextOffers[0] ? editorFor(nextOffers[0]) : null);
      setMessage("已删除");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="site-shell admin-shell">
      <header className="site-header"><Link className="brand" href="/"><span className="brand__dot" />Free LLM Hub</Link><Link className="header-link" href="/">返回活动库 <span aria-hidden="true">↗</span></Link></header>
      <div className="admin-heading"><div><p className="kicker">CONTENT ADMIN</p><h1>活动后台</h1><p>编辑、隐藏或删除所有活动记录。</p></div><button className="button button--secondary" onClick={() => void load()} disabled={loading}>刷新列表</button></div>
      {error && <p className="admin-alert" role="alert">{error}</p>}
      <div className="admin-layout">
        <aside className="admin-list" aria-label="活动记录">
          <div className="admin-list__header"><strong>全部条目</strong><span>{offers.length}</span></div>
          {loading ? <p className="admin-muted">正在加载…</p> : offers.length === 0 ? <p className="admin-muted">暂无条目</p> : offers.map((offer) => <button key={offer.id} className={`admin-list__item ${selectedId === offer.id ? "is-selected" : ""}`} onClick={() => select(offer)}><span><strong>{offer.providerName}</strong><small>{offer.id.slice(0, 8)}</small></span><em className={offer.status === "hidden" ? "is-hidden" : ""}>{offer.status === "hidden" ? "隐藏" : "展示"}</em></button>)}
        </aside>
        <section className="admin-editor" aria-label="编辑活动">
          {!editor ? <div className="state-panel"><strong>选择一条活动</strong></div> : <>
            <div className="admin-editor__header"><div><p className="section-kicker">编辑记录</p><h2>{editor.providerName || "未命名活动"}</h2><p className="admin-muted">创建于 {new Date(editor.createdAt).toLocaleString("zh-CN")}</p></div><div className="admin-actions"><button className="button button--secondary" onClick={remove} disabled={saving}>删除</button><button className="button button--primary" onClick={() => void save()} disabled={saving}>{saving ? "处理中…" : "保存更改"}</button></div></div>
            <div className="admin-form-grid">
              <label>提供商名称<input className="form-control" value={editor.providerName} onChange={(event) => update("providerName", event.target.value)} /></label>
              <label>官网地址<input className="form-control" type="url" value={editor.officialUrl} onChange={(event) => update("officialUrl", event.target.value)} /></label>
              <label>领取链接<input className="form-control" type="url" value={editor.claimUrl || ""} onChange={(event) => update("claimUrl", event.target.value)} /></label>
              <label>邀请码<input className="form-control" value={editor.inviteCode || ""} onChange={(event) => update("inviteCode", event.target.value)} /></label>
              <label>开始时间<input className="form-control" value={editor.startsAt || ""} onChange={(event) => update("startsAt", event.target.value)} placeholder="2026-08-01T00:00:00.000Z" /></label>
              <label>结束时间<input className="form-control" value={editor.endsAt || ""} onChange={(event) => update("endsAt", event.target.value)} placeholder="长期活动可留空" /></label>
            </div>
            <div className="admin-checks"><label><input type="checkbox" checked={editor.requiresInvite} onChange={(event) => update("requiresInvite", event.target.checked)} /> 需要邀请码</label><label><input type="checkbox" checked={editor.requiresNewAccount} onChange={(event) => update("requiresNewAccount", event.target.checked)} /> 需要新注册账号</label><label><input type="checkbox" checked={editor.isLongTerm} onChange={(event) => update("isLongTerm", event.target.checked)} /> 长期活动</label><label><input type="checkbox" checked={editor.status === "published"} onChange={(event) => update("status", event.target.checked ? "published" : "hidden")} /> 对外展示</label></div>
            <label className="admin-field">免费额度 JSON<textarea className="form-control admin-textarea" rows={8} value={editor.benefitsJson} onChange={(event) => update("benefitsJson", event.target.value)} /></label>
            <label className="admin-field">可用模型（每行一个）<textarea className="form-control admin-textarea" rows={3} value={editor.modelsText} onChange={(event) => update("modelsText", event.target.value)} /></label>
            <label className="admin-field">备注<textarea className="form-control admin-textarea" rows={5} value={editor.notes || ""} onChange={(event) => update("notes", event.target.value)} /></label>
            {message && <p className="admin-success" role="status">{message}</p>}
          </>}
        </section>
      </div>
    </main>
  );
}
