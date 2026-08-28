'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { signUp } from '@/lib/auth-client';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { Eye, EyeOff, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        setError(result.error.message || 'Registration failed');
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
          <div>
            <p className="font-serif text-[24px] leading-[32px] text-white drop-shadow-sm mb-3">
              {t('heroRegisterTitle')}
            </p>
            <p className="font-body text-lg leading-7 text-white/90 max-w-sm font-light drop-shadow-sm">
              {t('heroRegisterSubtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Right: Register Form */}
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
              {t('createAccount')}
            </h1>
            <p className="font-body text-base leading-6 text-[#3f484c]">
              {t('createAccountSubtitle')}
            </p>
          </div>

          {error && (
            <div className="bg-[#ffdad6] text-[#93000a] text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-6">
              {/* Full Name — floating label */}
              <div className="relative group">
                <input
                  id="fullName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder=" "
                  required
                  className="w-full bg-transparent border-b border-[#bec8cd] py-3 px-1 font-body text-base text-[#1a1c1c] focus:outline-none focus:border-[#005d72] transition-colors duration-300 peer"
                />
                <label
                  htmlFor="fullName"
                  className="absolute start-1 top-3 text-[#3f484c] font-body text-base transition-all duration-300 transform -translate-y-6 scale-75 origin-[0] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6 peer-focus:text-[#005d72] pointer-events-none"
                >
                  {t('fullNameLabel')}
                </label>
              </div>

              {/* Email — floating label */}
              <div className="relative group">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=" "
                  required
                  className="w-full bg-transparent border-b border-[#bec8cd] py-3 px-1 font-body text-base text-[#1a1c1c] focus:outline-none focus:border-[#005d72] transition-colors duration-300 peer"
                />
                <label
                  htmlFor="email"
                  className="absolute start-1 top-3 text-[#3f484c] font-body text-base transition-all duration-300 transform -translate-y-6 scale-75 origin-[0] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6 peer-focus:text-[#005d72] pointer-events-none"
                >
                  {t('emailLabel')}
                </label>
              </div>

              {/* Password — floating label */}
              <div className="relative group">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=" "
                  required
                  minLength={8}
                  className="w-full bg-transparent border-b border-[#bec8cd] py-3 px-1 pe-10 font-body text-base text-[#1a1c1c] focus:outline-none focus:border-[#005d72] transition-colors duration-300 peer"
                />
                <label
                  htmlFor="password"
                  className="absolute start-1 top-3 text-[#3f484c] font-body text-base transition-all duration-300 transform -translate-y-6 scale-75 origin-[0] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6 peer-focus:text-[#005d72] pointer-events-none"
                >
                  {t('passwordLabel')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-1 top-3 text-[#3f484c] hover:text-[#1a1c1c] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>

              {/* Confirm Password — floating label */}
              <div className="relative group">
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder=" "
                  required
                  minLength={8}
                  className="w-full bg-transparent border-b border-[#bec8cd] py-3 px-1 font-body text-base text-[#1a1c1c] focus:outline-none focus:border-[#005d72] transition-colors duration-300 peer"
                />
                <label
                  htmlFor="confirmPassword"
                  className="absolute start-1 top-3 text-[#3f484c] font-body text-base transition-all duration-300 transform -translate-y-6 scale-75 origin-[0] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6 peer-focus:text-[#005d72] pointer-events-none"
                >
                  {t('confirmPasswordLabel')}
                </label>
              </div>
            </div>

            {/* Newsletter checkbox */}
            <div className="flex items-start gap-3">
              <div className="flex items-center h-5 mt-1">
                <input
                  id="newsletter"
                  type="checkbox"
                  checked={newsletter}
                  onChange={(e) => setNewsletter(e.target.checked)}
                  className="w-4 h-4 rounded border-[#bec8cd] text-[#005d72] focus:ring-[#005d72] focus:ring-2 cursor-pointer accent-[#005d72]"
                />
              </div>
              <label htmlFor="newsletter" className="font-body text-sm text-[#3f484c] cursor-pointer">
                {t('newsletterSignup')}
              </label>
            </div>

            {/* Actions */}
            <div className="pt-4 space-y-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#565555] text-white font-body text-sm font-bold uppercase tracking-[0.1em] py-4 rounded-full hover:bg-[#1a1c1c] transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-70 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <span>{t('createAccount')}</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-300" />
                  </>
                )}
              </button>

              <div className="text-center">
                <p className="font-body text-base text-[#3f484c]">
                  {t('alreadyHaveAccount')}{' '}
                  <Link
                    href="/login"
                    className="font-body text-sm font-bold uppercase tracking-[0.1em] text-[#005d72] hover:text-[#007791] transition-colors relative after:absolute after:bottom-0 after:start-0 after:w-full after:h-px after:bg-current after:scale-x-0 hover:after:scale-x-100 after:origin-end hover:after:origin-start after:transition-transform after:duration-300"
                  >
                    {t('signInLink')}
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
