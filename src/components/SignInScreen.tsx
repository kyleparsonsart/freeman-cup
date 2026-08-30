import { useState } from 'react';

interface Props {
  sendCode: (email: string) => Promise<string | null>;
  verifyCode: (email: string, code: string) => Promise<string | null>;
  devSignIn: (email: string) => Promise<string | null>;
}

const DEV_SEATS = ['kyle', 'griffin', 'devin', 'brian', 'matt', 'phil', 'justin', 'jt'];

export default function SignInScreen({ sendCode, verifyCode, devSignIn }: Props) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const error = await sendCode(email.trim());
    setBusy(false);
    if (error) setErr(error);
    else setStep('code');
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const error = await verifyCode(email.trim(), code.trim());
    setBusy(false);
    if (error) setErr(error);
    // on success onAuthStateChange takes it from here
  };

  return (
    <div className="auth">
      <h2>Sign in</h2>
      {step === 'email' ? (
        <>
          <p className="asub">
            Enter the email your invite went to and we'll send you a six-digit code.
          </p>
          <form onSubmit={submitEmail} className="aform">
            <input
              className="ainput"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
            <button className="abtn" disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="asub">
            Sent to <b>{email.trim()}</b>. Enter the six-digit code from the email.
          </p>
          <form onSubmit={submitCode} className="aform">
            <input
              className="ainput code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="······"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
            />
            <button className="abtn" disabled={busy || code.length !== 6}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
          </form>
          <button
            type="button"
            className="aghost"
            onClick={() => { setStep('email'); setCode(''); setErr(null); }}
          >
            Use a different email
          </button>
        </>
      )}
      {err && <div className="aerr">{err}</div>}

      {import.meta.env.DEV && (
        <div className="adev">
          {DEV_SEATS.map(n => (
            <button key={n} onClick={async () => {
              setErr(null);
              const error = await devSignIn(`${n}@example.com`);
              if (error) setErr(error);
            }}>{n}</button>
          ))}
        </div>
      )}
    </div>
  );
}
