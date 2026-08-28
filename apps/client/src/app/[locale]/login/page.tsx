'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { signIn } from '@/lib/auth-client';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message || 'Login failed');
      } else {
        window.location.href = '/';
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f9f9f9]">
      {/* Left: Hero Image (Desktop only) */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <Image
          src="/hero/hero-banner.png"
          alt="BAIA Swimwear"
          fill
          priority
          sizes="50vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-between p-16">
          <h2
            dir="ltr"
            className="font-serif text-[64px] leading-[72px] tracking-[-0.02em] text-white max-w-md drop-shadow-md"
          >
            BAIA SWIMWEAR
          </h2>
          <p className="font-body text-lg leading-7 text-white/90 max-w-sm font-light drop-shadow-sm">
            {t('heroLoginSubtitle')}
          </p>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-5 sm:p-12 lg:p-24 bg-white">
        <div className="w-full max-w-md flex flex-col space-y-12">
          {/* Mobile Brand (hidden on desktop) */}
          <div className="lg:hidden flex flex-col items-center">
            <h2 dir="ltr" className="font-serif text-[40px] leading-[48px] text-[#1a1c1c] text-center">
              BAIA
            </h2>
          </div>

          {/* Heading */}
          <div className="flex flex-col space-y-4">
            <h1 className="font-serif text-[32px] leading-[40px] text-[#1a1c1c]">
              {t('welcomeBack')}
            </h1>
            <p className="font-body text-base leading-6 text-[#3f484c]">
              {t('signInSubtitle')}
            </p>
          </div>

          {error && (
            <div className="bg-[#ffdad6] text-[#93000a] text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col space-y-6">
            {/* Email */}
            <div className="flex flex-col space-y-2 relative group">
              <label
                htmlFor="email"
                className="font-body text-xs font-bold uppercase tracking-[0.1em] text-[#1a1c1c]"
              >
                {t('emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full bg-transparent border-b border-[#bec8cd] py-3 font-body text-base text-[#1a1c1c] focus:outline-none focus:border-[#005d72] transition-colors duration-300 placeholder:text-[#3f484c]/50"
              />
              <div className="absolute bottom-0 start-0 h-px bg-[#005d72] w-0 group-focus-within:w-full transition-all duration-500 ease-out" />
            </div>

            {/* Password */}
            <div className="flex flex-col space-y-2 relative group">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="password"
                  className="font-body text-xs font-bold uppercase tracking-[0.1em] text-[#1a1c1c]"
                >
                  {t('passwordLabel')}
                </label>
                <Link
                  href="#"
                  className="font-body text-xs font-medium tracking-[0.05em] text-[#005d72] hover:text-[#007791] transition-colors"
                >
                  {t('forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-transparent border-b border-[#bec8cd] py-3 pe-10 font-body text-base text-[#1a1c1c] focus:outline-none focus:border-[#005d72] transition-colors duration-300 placeholder:text-[#3f484c]/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-[#3f484c] hover:text-[#1a1c1c] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
              <div className="absolute bottom-0 start-0 h-px bg-[#005d72] w-0 group-focus-within:w-full transition-all duration-500 ease-out" />
            </div>

            {/* Actions */}
            <div className="pt-8 flex flex-col space-y-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#565555] text-white font-body text-sm font-bold uppercase tracking-[0.1em] py-4 rounded-sm hover:bg-[#1a1c1c] transition-colors duration-300 shadow-sm hover:shadow-md disabled:opacity-70 relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <span>{t('signIn')}</span>
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </button>

              <div className="text-center pt-6">
                <p className="font-body text-base text-[#3f484c]">
                  {t('newToBaia')}{' '}
                  <Link
                    href="/register"
                    className="font-body text-sm font-bold uppercase tracking-[0.1em] text-[#1a1c1c] underline underline-offset-4 decoration-[#bec8cd] hover:decoration-[#005d72] transition-colors ms-1"
                  >
                    {t('createAnAccount')}
                  </Link>
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
