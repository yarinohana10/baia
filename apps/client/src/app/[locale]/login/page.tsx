'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { signIn } from '@/lib/auth-client';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { Eye, EyeOff, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signIn.social({ provider: 'google' });
    } catch {
      setError('Something went wrong');
      setGoogleLoading(false);
    }
  };

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
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        {/* Back to home */}
        <div className="p-5 sm:p-8 lg:p-12 lg:pb-0">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-body text-sm text-[#3f484c] hover:text-[#1a1c1c] transition-colors"
          >
            <ArrowLeft size={16} className="rtl:rotate-180" />
            {t('backToHome')}
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center p-5 sm:p-12 lg:p-24">
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

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#bec8cd]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 font-body text-xs uppercase tracking-[0.1em] text-[#3f484c]">
                    {t('orContinueWith')}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 border border-[#bec8cd] bg-white text-[#1a1c1c] font-body text-sm font-medium py-3.5 rounded-sm hover:bg-[#f9f9f9] hover:border-[#3f484c] transition-colors duration-300 disabled:opacity-70"
              >
                {googleLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c3.42-3.15 5.384-7.786 5.384-13.615z" />
                      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
                    </svg>
                    {t('signInWithGoogle')}
                  </>
                )}
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
    </div>
  );
}
