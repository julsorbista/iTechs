import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { handleAPIError } from '../utils/api';
import logo from '../assets/logo.png';
import loginBackground from '../../assets/Game/game_one/Background/bg plain.png';
import { markStudentMenuAudioPrimed, stopStudentMenuLoop } from '../utils/studentMenuAudio';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, verifyOTP, requiresOTP, otpEmail, isLoading, user } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    stopStudentMenuLoop({ rewind: true });
  }, []);
  
  // Auto-redirect if already logged in
  useEffect(() => {
    if (user && user.role) {
      const redirectPaths = {
        TEACHER: '/teacher',
        SUPER_ADMIN: '/admin',
        STUDENT: '/student',
      };
      
      const redirectTo = redirectPaths[user.role] || '/';
      navigate(redirectTo, { replace: true });
    }
  }, [user, navigate]);

  // Helper function to mask email for display
  const maskEmail = (email) => {
    if (!email) return '';
    return email.replace(/(.{2}).*(@.*)/, '$1****$2');
  };
  
  // Form for login
  const loginForm = useForm({
    defaultValues: {
      username: '',
      password: '',
    },
  });

  // Form for OTP
  const otpForm = useForm({
    defaultValues: {
      otpCode: '',
    },
  });

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Check if already in OTP state
  useEffect(() => {
    if (requiresOTP) {
      setOtpStep(true);
    }
  }, [requiresOTP]);

  // Handle login form submission
  const onLoginSubmit = async (data) => {
    try {
      setIsSubmitting(true);
      
      const result = await login(data);
      
      if (result.requiresOTP) {
        setOtpStep(true);
        setCountdown(60); // 60 second countdown
        toast.success('OTP sent to your email');
      } else if (result.success) {
        toast.success('Login successful');

        if (result.user?.role === 'STUDENT') {
          markStudentMenuAudioPrimed();
        }
        
        // Redirect based on role
        const redirectPaths = {
          TEACHER: '/teacher',
          SUPER_ADMIN: '/admin',
          STUDENT: '/student',
        };
        
        const redirectTo = redirectPaths[result.user.role] || '/';
        navigate(redirectTo);
      }
    } catch (error) {
      const errorInfo = handleAPIError(error);
      toast.error(errorInfo.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle OTP verification
  const onOtpSubmit = async (data) => {
    try {
      setIsSubmitting(true);
      
      const result = await verifyOTP(otpEmail, data.otpCode);
      
      if (result.success) {
        toast.success('Verification successful');

        if (result.user?.role === 'STUDENT') {
          markStudentMenuAudioPrimed();
        }
        
        const redirectPaths = {
          TEACHER: '/teacher',
          SUPER_ADMIN: '/admin',
          STUDENT: '/student',
        };
        
        const redirectTo = redirectPaths[result.user.role] || '/';
        navigate(redirectTo);
      }
    } catch (error) {
      const errorInfo = handleAPIError(error);
      toast.error(errorInfo.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    
    try {
      // Re-submit login to trigger OTP resend
      const username = loginForm.getValues('username');
      const password = loginForm.getValues('password');
      await login({ username, password });
      
      setCountdown(60);
      toast.success('OTP resent successfully');
    } catch (error) {
      toast.error('Failed to resend OTP');
    }
  };

  // Show loading while checking auth status
  if (isLoading && !isSubmitting) {
    return (
      <div className="game-shell flex items-center justify-center">
        <div className="pixel-panel text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="login-page-shell page-enter"
      style={{ backgroundImage: `url(${loginBackground})` }}
    >
        <section className="pixel-panel mx-auto w-full max-w-md">
          {!otpStep ? (
            <>
              <div className="mb-8 text-center flex flex-col items-center">
                <img src={logo} alt="iTECHS" className="w-16 h-16 md:hidden mb-4 drop-shadow-sm" />
                <h2 className="text-3xl font-black text-gray-900">Account Login</h2>
                <p className="mt-1 text-sm font-semibold text-gray-600">Enter your credentials to continue.</p>
              </div>

              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email or Username
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="username@school.edu"
                      {...loginForm.register('username', { required: 'Username is required' })}
                    />
                    {loginForm.formState.errors.username && (
                      <p className="text-red-600 text-xs mt-1 font-semibold">
                        {loginForm.formState.errors.username.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="input-field pr-12"
                        placeholder="••••••••"
                        {...loginForm.register('password', { required: 'Password is required' })}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-red-600 text-xs mt-1 font-semibold">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full btn btn-primary py-3"
                >
                  {isSubmitting ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center animate-fade-in flex flex-col items-center">
              <img src={logo} alt="iTECHS" className="w-16 h-16 md:hidden mb-4 drop-shadow-sm" />
              <div className="mx-auto mb-4 w-fit rounded-xl border-2 border-(--ui-border) bg-(--ui-panel-strong) px-4 py-2 text-2xl">
                📱
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-2">Two-Factor Authentication</h2>
              <p className="text-gray-600 mb-8 text-sm font-semibold">
                We sent a secure code to your email <br/>
                <span className="hud-chip mt-2">{maskEmail(otpEmail)}</span>
              </p>

              <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6">
                <div>
                  <input
                    type="text"
                    className="input-field text-center text-3xl font-mono tracking-[0.5em] py-4"
                    placeholder="000000"
                    maxLength={6}
                    autoComplete="one-time-code"
                    {...otpForm.register('otpCode', {
                      required: 'Code required',
                      minLength: { value: 6, message: 'Must be 6 digits' },
                      pattern: { value: /^[0-9]+$/, message: 'Numbers only' }
                    })}
                  />
                  {otpForm.formState.errors.otpCode && (
                    <p className="text-red-500 text-sm mt-2 font-medium">
                      {otpForm.formState.errors.otpCode.message}
                    </p>
                  )}
                </div>

                <div className="space-y-4 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full btn btn-primary py-3"
                  >
                    {isSubmitting ? 'Verifying...' : 'Verify Code'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={countdown > 0}
                    className={`text-sm font-medium transition-colors ${
                      countdown > 0 ? 'text-gray-400' : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Verification Code'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <p className="text-center text-xs text-gray-500 mt-8 font-semibold">
            Secure academic access powered by iTECHS
          </p>
        </section>
      </div>
  );
};

export default LoginPage;
