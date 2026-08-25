import SubmissionForm from '@/components/submit/SubmissionForm';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '提交线索',
  description: '向 Free LLM Hub 分享可公开核验的免费模型额度与活动。',
};

export default function SubmitPage() {
  return (
    <main className="site-shell submit-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Free LLM Hub 首页"><span className="brand__dot" />Free LLM Hub</Link>
        <Link className="header-link" href="/"><span aria-hidden="true">←</span> 返回活动库</Link>
      </header>
      <div className="mx-auto max-w-4xl">
        <header className="submit-hero">
          <p className="kicker">COMMUNITY SUBMISSION</p>
          <h1>提交一条线索</h1>
          <p>发现新的免费模型额度？分享可公开核验的活动信息，让更多人及时用上。</p>
        </header>
        <SubmissionForm />
      </div>
      <footer className="site-footer"><span>Free LLM Hub · 社区共同维护</span><Link href="/">浏览全部活动 ↗</Link></footer>
    </main>
  );
}
