'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Clipboard,
  Copy,
  FileImage,
  ImagePlus,
  LoaderCircle,
  MessageCircleMore,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';

type Tone = 'soft' | 'balanced' | 'firm';
type Result = {
  replies: Record<Tone, string>;
  insight: string;
  reason: string[];
  nextStep: string;
  risk: '低' | '中';
  timing: string;
};

const toneMeta: Record<Tone, { label: string; hint: string }> = {
  soft: { label: '更柔和', hint: '保留更多余地' },
  balanced: { label: '推荐', hint: '关系与推进兼顾' },
  firm: { label: '更明确', hint: '给出清晰时间点' },
};

const demoText = `我：王老师，之前发您的活动方案，想请您抽空看一下。我们周五要定稿，您看今天方便给我一个反馈吗？\n对方：好的，我晚点看。\n我：好的，辛苦了！\n（两天过去了，对方还没有回复）`;

function classify(text: string) {
  if (/付款|打款|款项|报销|费用|发票|尾款/.test(text)) return 'payment';
  if (/文件|资料|方案|版本|交付|稿件|文档/.test(text)) return 'delivery';
  if (/会议|开会|时间|日程|预约|见面/.test(text)) return 'meeting';
  if (/审批|签字|盖章|确认|反馈|回复|意见/.test(text)) return 'feedback';
  return 'general';
}

function makeResult(
  text: string,
  relationship: string,
  urgency: number,
  outcome: string,
): Result {
  const scenario = classify(text);
  const hasPromise = /晚点|稍后|明天|今天|尽快|回头|待会|等下|一会/.test(text);
  const overdue = /没回复|未回复|过去|超时|还没有|没消息|几天|两天|三天/.test(text);
  const target = outcome.trim();
  const isClose = relationship === '朋友' || relationship === '家人';
  const risk = urgency >= 4 && isClose ? '中' : '低';

  const objectMap: Record<string, string> = {
    payment: '款项安排',
    delivery: '这份内容',
    meeting: '时间安排',
    feedback: '这件事',
    general: '这件事',
  };
  let subject = target || objectMap[scenario];
  if (scenario === 'payment') subject = target || '款项预计什么时候可以安排';
  if (scenario === 'meeting') subject = target || '哪个时间方便';
  if (scenario === 'delivery') subject = target || '这份内容的进度';

  const opener = isClose ? '想再跟你确认一下' : '想再跟您确认一下';
  const help = isClose
    ? '如果你这会儿不方便处理，也告诉我一个大概时间，我好安排后面的事。'
    : '如果您今天不方便处理，也请告诉我一个预计时间，我好安排后续。';
  const softEnd = isClose
    ? '你有空时回我一下就好，谢谢。'
    : '您方便时回复我一下就好，谢谢。';
  const deadline = urgency >= 5 ? '今天下班前' : urgency >= 4 ? '今天' : '方便时';
  const soft = `${opener}${subject === '这件事' ? '这件事的进度' : `：${subject}`}。${softEnd}`;
  const balanced = `${opener}${subject === '这件事' ? '这件事的进度' : `：${subject}`}。我这边接下来需要据此推进，想请您${deadline === '方便时' ? '有空时' : `${deadline}前`}给我一个回复；${help}`;
  const firm = `您好，再跟进一下${subject === '这件事' ? '这件事' : `“${subject}”`}。因为后续安排正在等待确认，请您在${deadline === '方便时' ? '今天' : deadline}前回复处理结果；如暂时无法完成，也请同步明确的预计时间，谢谢。`;

  const promiseText = hasPromise
    ? '对方已经表达过会处理，现在适合引用原约定并补一个明确时间点。'
    : '目前缺少明确承诺，先说明你的推进需要，再提出一个容易回答的请求。';
  const overdueText = overdue
    ? '已经有一段等待时间，这次不必再次长篇解释。'
    : '看不出明显超时，第一次跟进可以保持轻一些。';

  return {
    replies: { soft, balanced, firm },
    insight: `${promiseText}${overdueText}`,
    reason: [
      '先对事不对人，避免让对方感觉被指责',
      urgency >= 4 ? '说明你的时间限制，让催促有客观理由' : '交代后续需要，让对方理解为什么现在要回复',
      '允许对方回复预计时间，降低“必须立刻做完”的压力',
    ],
    nextStep:
      urgency >= 4
        ? '若到约定时间仍无回复，改用电话或语音，只确认“何时能处理”。'
        : '若 24 小时后仍无回复，补充具体截止时间，再发送一次。',
    risk,
    timing: overdue || hasPromise ? '建议现在发送' : '可在工作时段发送',
  };
}

export default function Home() {
  const [text, setText] = useState('');
  const [relationship, setRelationship] = useState('工作协作');
  const [urgency, setUrgency] = useState([3]);
  const [outcome, setOutcome] = useState('');
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [tone, setTone] = useState<Tone>('balanced');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.url);
    };
  }, [image]);

  const canAnalyze = text.trim().length > 4 || Boolean(image);
  const strengthLabel = useMemo(
    () => ['很轻', '柔和', '平衡', '明确', '强推进'][urgency[0] - 1],
    [urgency],
  );

  function setImageFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setImage((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { file, url: URL.createObjectURL(file) };
    });
    setResult(null);
  }

  function onPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(event.clipboardData.items).find((entry) =>
      entry.type.startsWith('image/'),
    );
    const file = item?.getAsFile();
    if (file) setImageFile(file);
  }

  async function recognizeImage() {
    if (!image) return text;
    setOcrProgress(0.04);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('chi_sim+eng', 1, {
        logger: (message) => {
          if (message.status === 'recognizing text' && typeof message.progress === 'number') {
            setOcrProgress(message.progress);
          }
        },
      });
      const recognized = await worker.recognize(image.file);
      await worker.terminate();
      const clean = recognized.data.text.replace(/\n{3,}/g, '\n\n').trim();
      if (clean) {
        setText((current) => (current.trim() ? `${current.trim()}\n\n${clean}` : clean));
        return text.trim() ? `${text.trim()}\n\n${clean}` : clean;
      }
      return text;
    } catch {
      return text;
    } finally {
      setOcrProgress(null);
    }
  }

  async function analyze() {
    setCopied(false);
    const source = image ? await recognizeImage() : text;
    if (!source.trim()) {
      setResult({
        replies: {
          soft: '截图里的文字没有识别清楚，可以补充粘贴几句关键对话后再试。',
          balanced: '截图里的文字没有识别清楚，可以补充粘贴几句关键对话后再试。',
          firm: '截图里的文字没有识别清楚，可以补充粘贴几句关键对话后再试。',
        },
        insight: '聊天截图可能过小、模糊或包含复杂背景。',
        reason: ['补充对方最后一句话', '补充已经等待多久', '说明希望对方接下来做什么'],
        nextStep: '补充文字后重新分析。',
        risk: '低',
        timing: '等待补充信息',
      });
      return;
    }
    setResult(makeResult(source, relationship, urgency[0], outcome));
    setTone(urgency[0] >= 5 ? 'firm' : urgency[0] <= 2 ? 'soft' : 'balanced');
  }

  async function copyReply() {
    if (!result) return;
    await navigator.clipboard.writeText(result.replies[tone]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function reset() {
    setText('');
    setOutcome('');
    setResult(null);
    setTone('balanced');
    setCopied(false);
    setImage((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  return (
    <main className="min-h-screen" onPaste={onPaste}>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="回到顶部">
          <span className="brand-mark" aria-hidden="true"><MessageCircleMore /></span>
          <span>回得刚刚好</span>
        </a>
        <div className="privacy-note"><ShieldCheck aria-hidden="true" /><span>聊天内容仅在本页处理</span></div>
      </header>

      <section className="workspace" id="top">
        <div className="intro">
          <div>
            <p className="eyebrow"><span /> 催促回复助手</p>
            <h1>不冒犯，也不含糊。</h1>
            <p className="intro-copy">把聊天记录交给我，找到既能推进事情、又照顾关系的那句话。</p>
          </div>
          <Button variant="ghost" className="example-button" onClick={() => { setText(demoText); setResult(null); }}>
            <Sparkles /> 填入示例
          </Button>
        </div>

        <div className="app-grid">
          <section className="composer-card" aria-labelledby="input-title">
            <div className="card-heading">
              <div><p className="step-label">01 · 事情经过</p><h2 id="input-title">把对话贴在这里</h2></div>
              {(text || image) && <Button variant="ghost" size="sm" onClick={reset}><RefreshCw /> 清空</Button>}
            </div>

            <div className="paste-zone">
              <Textarea
                value={text}
                onChange={(event) => { setText(event.target.value); setResult(null); }}
                placeholder={'粘贴聊天记录，或直接按 ⌘V 粘贴聊天截图…\n\n最好包含：对方最后一句、已经等了多久、你希望他做什么。'}
                aria-label="聊天记录"
                className="chat-input"
              />

              {image && (
                <div className="image-chip">
                  <img src={image.url} alt="已粘贴的聊天截图" />
                  <div>
                    <strong><FileImage /> 已添加聊天截图</strong>
                    <span>分析时会在本地识别图片文字</span>
                  </div>
                  <button type="button" aria-label="移除截图" onClick={() => setImage(null)}><X /></button>
                </div>
              )}

              <div className="paste-footer">
                <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) setImageFile(file); }} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><ImagePlus /> 选择截图</Button>
                <span><Clipboard /> 支持粘贴文字或图片</span>
              </div>
            </div>

            <div className="context-grid">
              <label>
                <span>你们的关系</span>
                <NativeSelect value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                  <NativeSelectOption>工作协作</NativeSelectOption><NativeSelectOption>客户</NativeSelectOption><NativeSelectOption>上级 / 长辈</NativeSelectOption><NativeSelectOption>朋友</NativeSelectOption><NativeSelectOption>家人</NativeSelectOption>
                </NativeSelect>
              </label>
              <label>
                <span>你希望对方做什么 <i>选填</i></span>
                <input value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="例如：确认最终方案" />
              </label>
            </div>

            <div className="strength-block">
              <div className="strength-label"><span>这次需要多大推进力度？</span><strong>{urgency[0]}/5 · {strengthLabel}</strong></div>
              <Slider min={1} max={5} step={1} value={urgency} onValueChange={(value) => { setUrgency(value as number[]); setResult(null); }} aria-label="推进力度" />
              <div className="strength-scale"><span>先轻轻提醒</span><span>必须明确答复</span></div>
            </div>

            <Button size="lg" className="analyze-button" disabled={!canAnalyze || ocrProgress !== null} onClick={analyze}>
              {ocrProgress !== null ? <><LoaderCircle className="spin" /> 正在读图 {Math.round(ocrProgress * 100)}%</> : <>帮我组织回复 <ArrowRight /></>}
            </Button>
          </section>

          <section className={`result-card ${result ? 'has-result' : ''}`} aria-live="polite">
            {!result ? (
              <div className="empty-result">
                <div className="empty-orbit" aria-hidden="true"><span><MessageCircleMore /></span></div>
                <p className="step-label">02 · 回复建议</p>
                <h2>把难开口的话，变得刚刚好</h2>
                <p>分析后，你会得到一条推荐回复、两种力度备选，以及下一步跟进建议。</p>
                <div className="empty-preview" aria-hidden="true"><span /><span /><span /></div>
              </div>
            ) : (
              <div className="result-content">
                <div className="result-topline">
                  <p className="step-label">02 · 回复建议</p>
                  <div className="signal-row"><span className="good-signal"><Check /> 关系风险 {result.risk}</span><span>{result.timing}</span></div>
                </div>
                <h2>建议这样回</h2>
                <div className="tone-tabs" role="tablist" aria-label="回复语气">
                  {(Object.keys(toneMeta) as Tone[]).map((key) => (
                    <button key={key} type="button" role="tab" aria-selected={tone === key} className={tone === key ? 'active' : ''} onClick={() => setTone(key)}>
                      <strong>{toneMeta[key].label}</strong><span>{toneMeta[key].hint}</span>
                    </button>
                  ))}
                </div>
                <div className="reply-box">
                  <span className="quote-mark">“</span><p>{result.replies[tone]}</p>
                  <Button variant="outline" size="sm" onClick={copyReply}>{copied ? <Check /> : <Copy />}{copied ? '已复制' : '复制回复'}</Button>
                </div>
                <div className="readout"><div className="readout-title"><Sparkles /><span>我的判断</span></div><p>{result.insight}</p></div>
                <div className="why-block"><h3>为什么这样说</h3><ul>{result.reason.map((item) => <li key={item}><Check /> <span>{item}</span></li>)}</ul></div>
                <div className="next-step"><div className="next-number">2</div><div><span>如果对方还是没回</span><p>{result.nextStep}</p></div></div>
              </div>
            )}
          </section>
        </div>
        <footer><ShieldCheck /> 截图识别与回复分析都在浏览器中完成，不会保存你的聊天内容。</footer>
      </section>
    </main>
  );
}
