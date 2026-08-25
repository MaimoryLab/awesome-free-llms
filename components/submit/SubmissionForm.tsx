'use client';

import Script from 'next/script';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';

type BenefitType = 'token' | 'voucher' | 'points';

type Benefit = {
  type: BenefitType;
  amount: string;
};

type FormState = {
  providerName: string;
  officialUrl: string;
  benefits: Benefit[];
  requiresInvite: boolean;
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
  benefits: [{ type: 'token', amount: '' }],
  requiresInvite: false,
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
};

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

  const updateBenefit = (index: number, key: keyof Benefit, value: string) => {
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
    if (form.benefits.some((benefit) => !benefit.amount || Number(benefit.amount) <= 0)) nextErrors.benefits = '请填写有效的免费额度';
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
          benefits: form.benefits.map((benefit) => ({ ...benefit, amount: Number(benefit.amount) })),
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
      <form onSubmit={submit} className="space-y-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase text-cyan-700">基本信息</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">分享一个免费额度</h2>
            <p className="mt-2 text-sm text-slate-500">请提供可公开核验的信息，帮助其他开发者快速找到可用的模型资源。</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="提供商名称" required error={errors.providerName}>
              <input value={form.providerName} onChange={(event) => update('providerName', event.target.value)} placeholder="例如 OpenAI" required className={inputClass(errors.providerName)} />
            </Field>
            <Field label="官网地址" required error={errors.officialUrl}>
              <input type="url" value={form.officialUrl} onChange={(event) => update('officialUrl', event.target.value)} placeholder="https://example.com" required className={inputClass(errors.officialUrl)} />
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div><p className="text-sm font-semibold uppercase text-cyan-700">免费额度</p><h2 className="mt-2 text-xl font-semibold text-slate-950">可获得什么</h2></div>
            <button type="button" onClick={() => update('benefits', [...form.benefits, { type: 'token', amount: '' }])} className="rounded-lg border border-cyan-200 px-3 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-50">+ 添加额度</button>
          </div>
          <div className="space-y-3">
            {form.benefits.map((benefit, index) => <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><select aria-label="额度类型" value={benefit.type} onChange={(event) => updateBenefit(index, 'type', event.target.value)} className={inputClass(errors.benefits)}>{Object.entries(benefitLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label="额度数额" type="number" min="0" step="any" value={benefit.amount} onChange={(event) => updateBenefit(index, 'amount', event.target.value)} placeholder="数额" className={inputClass(errors.benefits)} />{form.benefits.length > 1 ? <button type="button" aria-label="删除额度" onClick={() => update('benefits', form.benefits.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg px-3 text-slate-400 hover:bg-slate-100 hover:text-slate-700">删除</button> : <span />}</div>)}
          </div>
          {errors.benefits && <p className="mt-3 text-sm text-rose-600">{errors.benefits}</p>}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase text-cyan-700">领取条件</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Toggle label="需要邀请码" description="领取活动前需要填写指定邀请码" checked={form.requiresInvite} onChange={(checked) => { update('requiresInvite', checked); if (!checked) update('inviteCode', ''); }} />
            {form.requiresInvite && <Field label="邀请码" required error={errors.inviteCode}><input value={form.inviteCode} onChange={(event) => update('inviteCode', event.target.value)} placeholder="请输入邀请码" required className={inputClass(errors.inviteCode)} /></Field>}
            <Field label="一键领取链接" hint="可选" error={errors.claimUrl}><input type="url" value={form.claimUrl} onChange={(event) => update('claimUrl', event.target.value)} placeholder="https://example.com/claim" className={inputClass(errors.claimUrl)} /></Field>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase text-cyan-700">活动时间</p>
          <div className="mt-5"><Toggle label="长期活动" description="活动持续有效，不设置结束时间" checked={form.isLongTerm} onChange={(checked) => { update('isLongTerm', checked); if (checked) update('endsAt', ''); }} /></div>
          <div className="mt-4 grid gap-5 sm:grid-cols-2"><Field label="开始时间" required={!form.isLongTerm} error={errors.startsAt}><input type="datetime-local" required={!form.isLongTerm} value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} className={inputClass(errors.startsAt)} /></Field><Field label="结束时间" required={!form.isLongTerm} hint={form.isLongTerm ? '长期活动无需填写' : undefined} error={errors.endsAt}><input type="datetime-local" required={!form.isLongTerm} disabled={form.isLongTerm} value={form.endsAt} onChange={(event) => update('endsAt', event.target.value)} className={inputClass(errors.endsAt)} /></Field></div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2"><Field label="可以使用的模型" hint="可选，每行一个"><div className="space-y-2">{form.models.map((model, index) => <div key={index} className="flex gap-2"><input value={model} onChange={(event) => updateModel(index, event.target.value)} placeholder="例如 gpt-4o-mini" className={inputClass(errors.models)} />{form.models.length > 1 && <button type="button" aria-label="删除模型" onClick={() => update('models', form.models.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg px-3 text-slate-400 hover:bg-slate-100 hover:text-slate-700">删除</button>}</div>)}<button type="button" onClick={() => update('models', [...form.models, ''])} className="text-sm font-semibold text-cyan-800 hover:text-cyan-950">+ 添加模型</button></div></Field><Field label="备注" hint="可选"><textarea rows={5} maxLength={2000} value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="补充活动限制、地区或使用说明" className={inputClass()} /></Field></div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-6 sm:p-8"><p className="text-sm font-semibold text-slate-800">安全验证</p><div ref={turnstileRef} className="mt-4 min-h-[65px]" />{!siteKey && <p className="text-sm text-amber-700">尚未配置 Turnstile 站点密钥，暂时无法提交。</p>}{siteKey && !turnstileReady && <p className="text-sm text-slate-500">正在加载验证...</p>}{turnstileError && <p className="mt-2 text-sm text-rose-600">{turnstileError}</p>}</section>
        {errors.form && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.form}</p>}
        {successId && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">提交成功，编号：<strong>{successId}</strong>。感谢你的分享！</div>}
        <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between"><Link href="/" className="text-center text-sm font-semibold text-slate-600 hover:text-slate-950">返回活动列表</Link><button type="submit" disabled={submitting || !turnstileToken || !siteKey} className="rounded-lg bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? '提交中...' : '提交线索'}</button></div>
      </form>
    </>
  );
}

function inputClass(error?: string) {
  return `w-full rounded-lg border bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 ${error ? 'border-rose-400' : 'border-slate-200'}`;
}

function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return <div><label className="mb-2 block text-sm font-semibold text-slate-700">{label} {required && <span className="text-rose-500">*</span>} {hint && <span className="font-normal text-slate-400">({hint})</span>}</label>{children}{error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}</div>;
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-cyan-300">
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span className="mt-1 block text-xs text-slate-500">{description}</span>
      </span>
      <span className="relative shrink-0">
        <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
        <span className="block h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-cyan-700 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan-700" />
        <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
