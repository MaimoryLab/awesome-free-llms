'use client';

import Script from 'next/script';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';

type BenefitType = 'token' | 'voucher' | 'points' | 'token-plan' | 'other';

type Benefit = {
  type: BenefitType;
  amount: string;
  unit: string;
  planName: string;
  validDays: string;
  description: string;
};

type FormState = {
  providerName: string;
  officialUrl: string;
  benefits: Benefit[];
  requiresInvite: boolean;
  requiresNewAccount: boolean;
  inviteCode: string;
  claimUrl: string;
  startsAt: string;
  endsAt: string;
  isLongTerm: boolean;
  notes: string;
  models: string[];
};

type TurnstileInstance = {
  render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileInstance;
  }
}

const initialState: FormState = {
  providerName: '',
  officialUrl: '',
  benefits: [{ type: 'token', amount: '', unit: 'million-token', planName: '', validDays: '', description: '' }],
  requiresInvite: false,
  requiresNewAccount: false,
  inviteCode: '',
  claimUrl: '',
  startsAt: '',
  endsAt: '',
  isLongTerm: false,
  notes: '',
  models: [''],
};

const benefitLabels: Record<BenefitType, string> = {
  token: 'Token',
  voucher: '代金券',
  points: '积分',
  'token-plan': 'Token Plan',
  other: '其他',
};

const sectionClass = 'rounded-md border border-[var(--line)] bg-white p-5 shadow-[0_1px_2px_rgba(23,33,28,0.04)] sm:p-7';
const kickerClass = 'text-xs font-bold uppercase tracking-[.12em] text-[var(--orange)]';

export default function SubmissionForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileError, setTurnstileError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState('');
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  const renderTurnstile = () => {
    if (!siteKey || !turnstileRef.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(turnstileRef.current, {
      sitekey: siteKey,
      callback: (token) => {
        setTurnstileToken(token);
        setTurnstileError('');
      },
      'expired-callback': () => {
        setTurnstileToken('');
        setTurnstileError('验证已过期，请重新完成验证');
      },
      'error-callback': () => {
        setTurnstileToken('');
        setTurnstileError('验证加载失败，请刷新后重试');
      },
    });
    setTurnstileReady(true);
  };

  useEffect(() => {
    renderTurnstile();
  });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const updateBenefit = <K extends keyof Benefit>(index: number, key: K, value: Benefit[K]) => {
    setForm((current) => ({
      ...current,
      benefits: current.benefits.map((benefit, itemIndex) => itemIndex === index ? { ...benefit, [key]: value } : benefit),
    }));
    setErrors((current) => ({ ...current, benefits: '' }));
  };

  const updateModel = (index: number, value: string) => {
    setForm((current) => ({ ...current, models: current.models.map((model, itemIndex) => itemIndex === index ? value : model) }));
    setErrors((current) => ({ ...current, models: '' }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.providerName.trim()) nextErrors.providerName = '请输入提供商名称';
    if (!form.officialUrl.trim()) nextErrors.officialUrl = '请输入官网地址';
    if (form.benefits.some((benefit) => {
      if (benefit.type === 'token-plan') return !benefit.planName.trim() || !Number.isInteger(Number(benefit.validDays)) || Number(benefit.validDays) <= 0;
      if (benefit.type === 'other') return !benefit.description.trim();
      return !benefit.amount || Number(benefit.amount) <= 0;
    })) nextErrors.benefits = '请完整填写免费额度';
    if (form.requiresInvite && !form.inviteCode.trim()) nextErrors.inviteCode = '需要邀请码时必须填写邀请码';
    if (form.claimUrl && !/^https?:\/\//i.test(form.claimUrl)) nextErrors.claimUrl = '领取链接必须是 HTTP(S) 地址';
    if (!form.isLongTerm && !form.startsAt) nextErrors.startsAt = '非长期活动必须填写开始时间';
    if (!form.isLongTerm && !form.endsAt) nextErrors.endsAt = '非长期活动必须填写结束时间';
    if (!form.isLongTerm && form.startsAt && form.endsAt && new Date(form.endsAt) < new Date(form.startsAt)) nextErrors.endsAt = '结束时间不能早于开始时间';
    if (!turnstileToken) setTurnstileError('请先完成安全验证');
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0 && Boolean(turnstileToken);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessId('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          providerName: form.providerName.trim(),
          officialUrl: form.officialUrl.trim(),
          inviteCode: form.requiresInvite ? form.inviteCode.trim() : undefined,
          claimUrl: form.claimUrl.trim() || undefined,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
          endsAt: form.isLongTerm || !form.endsAt ? undefined : new Date(form.endsAt).toISOString(),
          benefits: form.benefits.map((benefit) => {
            if (benefit.type === 'token-plan') return { type: benefit.type, planName: benefit.planName.trim(), validDays: Number(benefit.validDays) };
            if (benefit.type === 'other') return { type: benefit.type, description: benefit.description.trim() };
            if (benefit.type === 'token') return { type: benefit.type, amount: Number(benefit.amount), unit: 'million-token' };
            if (benefit.type === 'voucher') return { type: benefit.type, amount: Number(benefit.amount), unit: benefit.unit || undefined };
            return { type: benefit.type, amount: Number(benefit.amount) };
          }),
          models: form.models.map((model) => model.trim()).filter(Boolean),
          turnstileToken,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fields = payload?.error?.fields as Record<string, string> | undefined;
        setErrors(fields ? Object.fromEntries(Object.entries(fields).map(([field, message]) => [field === '_form' ? 'form' : field.split('.')[0], message])) : { form: payload?.error?.message ?? '提交失败，请检查表单后重试' });
        return;
      }
      setSuccessId(payload?.item?.id ?? payload?.data?.id ?? payload?.id ?? '已提交');
      setForm(initialState);
      setTurnstileToken('');
      if (window.turnstile && widgetId.current) window.turnstile.reset(widgetId.current);
    } catch {
      setErrors({ form: '网络异常，请稍后重试' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={() => { setTurnstileReady(true); renderTurnstile(); }} />
      <form onSubmit={submit} className="space-y-6">
        <section className={sectionClass}>
          <div className="mb-6">
            <p className={kickerClass}>基本信息</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--ink)]">分享一个免费额度</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">请提供可公开核验的信息，帮助其他开发者快速找到可用的模型资源。</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="提供商名称" htmlFor="providerName" required error={errors.providerName}>
              <input id="providerName" aria-invalid={Boolean(errors.providerName)} aria-describedby={errors.providerName ? 'providerName-error' : undefined} value={form.providerName} onChange={(event) => update('providerName', event.target.value)} placeholder="例如 OpenAI" required className={inputClass(errors.providerName)} />
            </Field>
            <Field label="官网地址" htmlFor="officialUrl" required error={errors.officialUrl}>
              <input id="officialUrl" aria-invalid={Boolean(errors.officialUrl)} aria-describedby={errors.officialUrl ? 'officialUrl-error' : undefined} type="url" value={form.officialUrl} onChange={(event) => update('officialUrl', event.target.value)} placeholder="https://example.com" required className={inputClass(errors.officialUrl)} />
            </Field>
          </div>
        </section>

        <section className={sectionClass}>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div><p className={kickerClass}>免费额度</p><h2 className="mt-2 text-xl font-semibold text-[var(--ink)]">可获得什么</h2></div>
            <button type="button" onClick={() => update('benefits', [...form.benefits, { type: 'token', amount: '', unit: 'million-token', planName: '', validDays: '', description: '' }])} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-semibold text-[var(--green)] transition hover:border-[var(--green)] hover:bg-[var(--mint)]">+ 添加额度</button>
          </div>
          <div className="space-y-3">
            {form.benefits.map((benefit, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
                <Field label="额度类型" htmlFor={`benefit-${index}-type`}>
                  <select id={`benefit-${index}-type`} aria-invalid={Boolean(errors.benefits)} aria-describedby={errors.benefits ? 'benefits-error' : undefined} value={benefit.type} onChange={(event) => { const type = event.target.value as BenefitType; updateBenefit(index, 'type', type); updateBenefit(index, 'unit', type === 'token' ? 'million-token' : ''); }} className={inputClass(errors.benefits)}>{Object.entries(benefitLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                </Field>
                <BenefitFields benefit={benefit} index={index} error={errors.benefits} onChange={updateBenefit} />
                {form.benefits.length > 1 && <button type="button" aria-label="删除额度" onClick={() => update('benefits', form.benefits.filter((_, itemIndex) => itemIndex !== index))} className="min-h-11 rounded-md px-3 text-slate-500 hover:bg-slate-100 hover:text-slate-800">删除</button>}
              </div>
            ))}
          </div>
          {errors.benefits && <p id="benefits-error" role="alert" className="mt-3 text-sm text-rose-700">{errors.benefits}</p>}
        </section>

        <section className={sectionClass}>
          <p className={kickerClass}>领取条件</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Toggle label="需要邀请码" description="领取活动前需要填写指定邀请码" checked={form.requiresInvite} onChange={(checked) => { update('requiresInvite', checked); if (!checked) update('inviteCode', ''); }} />
            {form.requiresInvite && <Field label="邀请码" htmlFor="inviteCode" required error={errors.inviteCode}><input id="inviteCode" aria-invalid={Boolean(errors.inviteCode)} aria-describedby={errors.inviteCode ? 'inviteCode-error' : undefined} value={form.inviteCode} onChange={(event) => update('inviteCode', event.target.value)} placeholder="请输入邀请码" required className={inputClass(errors.inviteCode)} /></Field>}
            <Toggle label="需要新注册账号" description="活动仅适用于新注册的用户账号" checked={form.requiresNewAccount} onChange={(checked) => update('requiresNewAccount', checked)} />
            <Field label="一键领取链接" htmlFor="claimUrl" hint="可选" error={errors.claimUrl}><input id="claimUrl" aria-invalid={Boolean(errors.claimUrl)} aria-describedby={errors.claimUrl ? 'claimUrl-error' : undefined} type="url" value={form.claimUrl} onChange={(event) => update('claimUrl', event.target.value)} placeholder="https://example.com/claim" className={inputClass(errors.claimUrl)} /></Field>
          </div>
        </section>

        <section className={sectionClass}>
          <p className={kickerClass}>活动时间</p>
          <div className="mt-5"><Toggle label="长期活动" description="活动持续有效，不设置结束时间" checked={form.isLongTerm} onChange={(checked) => { update('isLongTerm', checked); if (checked) update('endsAt', ''); }} /></div>
          <div className="mt-4 grid gap-5 sm:grid-cols-2"><Field label="开始时间" htmlFor="startsAt" required={!form.isLongTerm} error={errors.startsAt}><input id="startsAt" aria-invalid={Boolean(errors.startsAt)} aria-describedby={errors.startsAt ? 'startsAt-error' : undefined} type="datetime-local" required={!form.isLongTerm} value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} className={inputClass(errors.startsAt)} /></Field><Field label="结束时间" htmlFor="endsAt" required={!form.isLongTerm} hint={form.isLongTerm ? '长期活动无需填写' : undefined} error={errors.endsAt}><input id="endsAt" aria-invalid={Boolean(errors.endsAt)} aria-describedby={errors.endsAt ? 'endsAt-error' : undefined} type="datetime-local" required={!form.isLongTerm} disabled={form.isLongTerm} value={form.endsAt} onChange={(event) => update('endsAt', event.target.value)} className={inputClass(errors.endsAt)} /></Field></div>
        </section>

        <section className={sectionClass}>
          <div className="grid gap-5 sm:grid-cols-2"><Field label="可以使用的模型" htmlFor="model-0" hint="可选，每行一个" error={errors.models}><div className="space-y-2">{form.models.map((model, index) => <div key={index} className="flex gap-2"><input id={`model-${index}`} aria-label={index === 0 ? undefined : `模型 ${index + 1}`} value={model} onChange={(event) => updateModel(index, event.target.value)} placeholder="例如 gpt-4o-mini" className={inputClass(errors.models)} />{form.models.length > 1 && <button type="button" aria-label="删除模型" onClick={() => update('models', form.models.filter((_, itemIndex) => itemIndex !== index))} className="min-h-11 rounded-md px-3 text-slate-500 hover:bg-slate-100 hover:text-slate-800">删除</button>}</div>)}<button type="button" onClick={() => update('models', [...form.models, ''])} className="min-h-11 text-sm font-semibold text-[var(--green)] hover:text-[var(--green-dark)]">+ 添加模型</button></div></Field><Field label="备注" htmlFor="notes" hint="可选" error={errors.notes}><textarea id="notes" rows={5} maxLength={2000} value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="补充活动限制、地区或使用说明" className={inputClass(errors.notes)} /></Field></div>
        </section>

        <section className="rounded-md border border-[var(--line)] bg-[#e9eee9] p-5 sm:p-7"><p className="text-sm font-semibold text-[var(--ink)]">安全验证</p><div ref={turnstileRef} className="mt-4 min-h-[65px]" />{!siteKey && <p className="text-sm text-amber-800">尚未配置 Turnstile 站点密钥，暂时无法提交。</p>}{siteKey && !turnstileReady && <p className="text-sm text-[var(--muted)]">正在加载验证...</p>}{turnstileError && <p role="alert" className="mt-2 text-sm text-rose-700">{turnstileError}</p>}</section>
        {errors.form && <p role="alert" className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">{errors.form}</p>}
        {successId && <div role="status" aria-live="polite" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">提交成功，编号：<strong>{successId}</strong>。感谢你的分享！</div>}
        <div className="flex flex-col-reverse gap-4 pb-16 sm:flex-row sm:items-center sm:justify-between"><Link href="/" className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">返回活动列表</Link><button type="submit" aria-busy={submitting} disabled={submitting || !turnstileToken || !siteKey} className="min-h-12 rounded-md bg-[var(--green)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--green-dark)] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? '提交中...' : '提交线索'}</button></div>
      </form>
    </>
  );
}

function inputClass(error?: string) {
  return `form-control ${error ? 'is-invalid' : ''}`;
}

function BenefitFields({ benefit, index, error, onChange }: { benefit: Benefit; index: number; error?: string; onChange: <K extends keyof Benefit>(index: number, key: K, value: Benefit[K]) => void }) {
  const describedBy = error ? 'benefits-error' : undefined;
  if (benefit.type === 'token-plan') return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="套餐名称" htmlFor={`benefit-${index}-plan`}><input id={`benefit-${index}-plan`} aria-invalid={Boolean(error)} aria-describedby={describedBy} value={benefit.planName} onChange={(event) => onChange(index, 'planName', event.target.value)} maxLength={120} className={inputClass(error)} /></Field>
      <Field label="有效天数" htmlFor={`benefit-${index}-days`}><input id={`benefit-${index}-days`} aria-invalid={Boolean(error)} aria-describedby={describedBy} type="number" min="1" step="1" value={benefit.validDays} onChange={(event) => onChange(index, 'validDays', event.target.value)} className={inputClass(error)} /></Field>
    </div>
  );
  if (benefit.type === 'other') return <Field label="说明" htmlFor={`benefit-${index}-description`}><input id={`benefit-${index}-description`} aria-invalid={Boolean(error)} aria-describedby={describedBy} value={benefit.description} onChange={(event) => onChange(index, 'description', event.target.value)} maxLength={500} className={inputClass(error)} /></Field>;
  return (
    <div className={`grid gap-3 ${benefit.type === 'points' ? '' : 'sm:grid-cols-2'}`}>
      <Field label="数额" htmlFor={`benefit-${index}-amount`}><input id={`benefit-${index}-amount`} aria-invalid={Boolean(error)} aria-describedby={describedBy} type="number" min="0" step="any" value={benefit.amount} onChange={(event) => onChange(index, 'amount', event.target.value)} className={inputClass(error)} /></Field>
      {benefit.type === 'token' && <Field label="单位" htmlFor={`benefit-${index}-unit`}><input id={`benefit-${index}-unit`} value="百万 Token" readOnly className={`${inputClass()} bg-[var(--paper)] text-[var(--muted)]`} /></Field>}
      {benefit.type === 'voucher' && <Field label="单位" htmlFor={`benefit-${index}-unit`} hint="可选"><select id={`benefit-${index}-unit`} value={benefit.unit} onChange={(event) => onChange(index, 'unit', event.target.value)} className={inputClass()}><option value="">未注明</option><option value="USD">美元 ($)</option><option value="CNY">人民币 (¥)</option></select></Field>}
    </div>
  );
}

function Field({ label, htmlFor, required, hint, error, children }: { label: string; htmlFor?: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return <div><label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-[var(--ink)]">{label} {required && <span className="text-rose-600" aria-hidden="true">*</span>} {hint && <span className="font-normal text-[var(--muted)]">({hint})</span>}</label>{children}{error && <p id={htmlFor ? `${htmlFor}-error` : undefined} className="mt-1.5 text-xs text-rose-700">{error}</p>}</div>;
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-md border border-[var(--line)] bg-[var(--paper)] px-4 py-3 transition hover:border-[var(--green)]">
      <span>
        <span className="block text-sm font-semibold text-[var(--ink)]">{label}</span>
        <span className="mt-1 block text-xs text-[var(--muted)]">{description}</span>
      </span>
      <span className="relative shrink-0">
        <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
        <span className="block h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-[var(--green)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]" />
        <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
