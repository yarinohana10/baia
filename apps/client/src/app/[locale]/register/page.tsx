'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { signUp } from '@/lib/auth-client';
import { Link } from '@/i18n/navigation';

export default function RegisterPage() {
  const t = useTranslations('common');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
    <div className="min-h-screen flex items-center justify-center bg-ocean-50 px-4">
      <div className="w-full max-w-md bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-light tracking-widest text-center text-ocean-700 mb-8">
          BAIA
        </h1>
        <h2 className="text-xl font-light text-center mb-6">{t('register')}</h2>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 mb-4 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 focus:border-ocean-500 focus:outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 focus:border-ocean-500 focus:outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 focus:border-ocean-500 focus:outline-none transition-colors"
              minLength={8}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ocean-700 text-white py-2.5 text-sm font-medium tracking-wider uppercase hover:bg-ocean-800 transition-colors disabled:opacity-50"
          >
            {loading ? '...' : t('register')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/login" className="text-ocean-600 hover:text-ocean-700">
            {t('login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
