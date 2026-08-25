import SubmissionForm from '@/components/submit/SubmissionForm';
import Link from 'next/link';

export default function SubmitPage() {
  return (
    <main className="min-h-screen bg-[#f6f8fb] px-4 py-10 text-slate-950 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10 max-w-2xl">
          <Link href="/" className="text-sm font-semibold text-cyan-700 hover:text-cyan-900">← 免费 LLM 活动库</Link>
          <h1 className="mt-5 text-4xl font-semibold sm:text-5xl">提交一条线索</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">发现新的免费模型额度？把活动信息提交给社区，让更多人及时用上。</p>
        </header>
        <SubmissionForm />
      </div>
    </main>
  );
}
