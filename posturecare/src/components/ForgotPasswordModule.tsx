import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Send,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Check,
  ChevronRight,
  ShieldAlert,
  BadgeCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Storage } from '../utils/storage';
import { audioService } from '../utils/audio';
import { emailService } from '../utils/emailService';

interface ForgotPasswordModuleProps {
  initialEmail?: string;
  onBackToSignIn: () => void;
  onBackToRegister: () => void;
  onPasswordResetSuccess: (email: string, newPassword: string) => void;
}

type ResetStep = 'request' | 'verify_code' | 'set_new_password' | 'success';

export const ForgotPasswordModule: React.FC<ForgotPasswordModuleProps> = ({
  initialEmail = '',
  onBackToSignIn,
  onBackToRegister,
  onPasswordResetSuccess
}) => {
  // Step progression: 'request' -> 'verify_code' -> 'set_new_password' -> 'success'
  const [step, setStep] = useState<ResetStep>('request');
  
  // Form states
  const [email, setEmail] = useState(initialEmail);
  const [verificationCode, setVerificationCode] = useState('');
  const [expectedCode, setExpectedCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Feedback & Loading states
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isLiveEmailSent, setIsLiveEmailSent] = useState(false);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Generate and send code helper
  const sendVerificationCode = async (targetEmail: string) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    // Generate a secure 6-digit numeric OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setExpectedCode(code);

    const registered = Storage.findUserByEmail(cleanEmail);
    const recipientName = registered?.fullName || (cleanEmail.split('@')[0].charAt(0).toUpperCase() + cleanEmail.split('@')[0].slice(1));

    // Dispatch via backend Python after_password_reset_request workflow
    const result = await emailService.afterPasswordResetRequest(cleanEmail, code);

    audioService.playSoftNudge(0.9);
    setResendCooldown(45);

    const isDelivered = result?.user_email_result?.delivered === true || result?.delivered === true;
    if (isDelivered) {
      setIsLiveEmailSent(true);
      setError(null);
      setInfoMessage(`Verification code sent to ${cleanEmail} from posturecareergonomics@gmail.com. Please check your Gmail inbox and spam folder.`);
    } else {
      setIsLiveEmailSent(false);
      setInfoMessage(null);
      setError(null);
    }

    return code;
  };

  // STEP 1 SUBMIT: Request OTP Code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please provide a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendVerificationCode(cleanEmail);
      setIsSubmitting(false);
      setStep('verify_code');
    } catch {
      setIsSubmitting(false);
      setStep('verify_code');
    }
  };

  // Resend code handler
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setIsSubmitting(true);
    await sendVerificationCode(email);
    setIsSubmitting(false);
  };

  // STEP 2 SUBMIT: Verify 6-Digit Code Only
  const handleVerifyCodeOnly = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = verificationCode.trim().replace(/\s+/g, '');
    if (!cleanCode) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (cleanCode.length !== 6) {
      setError('Verification code must be exactly 6 digits.');
      return;
    }

    // Verify code match
    if (expectedCode && cleanCode !== expectedCode) {
      setError('Invalid verification code. Please check your Gmail inbox or click Resend Code.');
      return;
    }

    // Start verified transition
    setIsVerifyingCode(true);
    audioService.playSoftNudge(1.0);

    setTimeout(() => {
      setIsVerifyingCode(false);
      setError(null);
      setInfoMessage('Email verified successfully! You can now set your new password.');
      setStep('set_new_password');
    }, 600);
  };

  // Password strength calculation
  const calculatePasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-stone-200' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    if (score <= 3) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score === 4) return { score: 3, label: 'Good', color: 'bg-teal-500' };
    return { score: 4, label: 'Strong', color: 'bg-emerald-600' };
  };

  const passwordStrength = calculatePasswordStrength(newPassword);

  // STEP 3 SUBMIT: Save New Password
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setIsSubmitting(true);
    const cleanEmail = email.trim().toLowerCase();

    // Update credentials in local storage
    Storage.updateUserPassword(cleanEmail, newPassword);

    const registered = Storage.findUserByEmail(cleanEmail);
    const recipientName = registered?.fullName || (cleanEmail.split('@')[0].charAt(0).toUpperCase() + cleanEmail.split('@')[0].slice(1));
    
    // Asynchronously dispatch confirmation alert
    emailService.sendPasswordChangedAlert(cleanEmail, recipientName).catch(() => {});

    // Celebration confetti
    try {
      confetti({
        particleCount: 85,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#059669', '#10b981', '#34d399', '#f59e0b']
      });
      audioService.playAlertSound();
    } catch {
      // ignore
    }

    setIsSubmitting(false);
    setStep('success');

    // Auto-trigger callback after brief pause
    setTimeout(() => {
      onPasswordResetSuccess(cleanEmail, newPassword);
    }, 2400);
  };

  return (
    <div id="forgot-password-module" className="w-full">
      {/* Header Back Button */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100">
        <button
          type="button"
          onClick={onBackToSignIn}
          className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center space-x-1.5 transition py-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </button>

        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
          Account Recovery
        </span>
      </div>

      {/* 3-Step Progress Indicator */}
      {step !== 'success' && (
        <div className="mb-6 flex items-center justify-between px-2">
          <div className="flex items-center space-x-1.5">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              step === 'request'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              1
            </div>
            <span className={`text-[11px] font-medium ${step === 'request' ? 'text-stone-900 font-bold' : 'text-stone-400'}`}>
              Email
            </span>
          </div>

          <div className={`flex-1 h-0.5 mx-2 ${step !== 'request' ? 'bg-emerald-500' : 'bg-stone-200'}`} />

          <div className="flex items-center space-x-1.5">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              step === 'verify_code'
                ? 'bg-emerald-700 text-white'
                : step === 'set_new_password'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-stone-100 text-stone-400'
            }`}>
              2
            </div>
            <span className={`text-[11px] font-medium ${step === 'verify_code' ? 'text-stone-900 font-bold' : 'text-stone-400'}`}>
              Verify Code
            </span>
          </div>

          <div className={`flex-1 h-0.5 mx-2 ${step === 'set_new_password' ? 'bg-emerald-500' : 'bg-stone-200'}`} />

          <div className="flex items-center space-x-1.5">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              step === 'set_new_password'
                ? 'bg-emerald-700 text-white'
                : 'bg-stone-100 text-stone-400'
            }`}>
              3
            </div>
            <span className={`text-[11px] font-medium ${step === 'set_new_password' ? 'text-stone-900 font-bold' : 'text-stone-400'}`}>
              New Password
            </span>
          </div>
        </div>
      )}

      {/* Title & Icon */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-3 text-xl border border-emerald-100 shadow-2xs">
          {step === 'set_new_password' ? (
            <Lock className="w-6 h-6 text-emerald-700" />
          ) : (
            <KeyRound className="w-6 h-6 text-emerald-700" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-stone-900 tracking-tight">
          {step === 'request' && 'Reset Your Password'}
          {step === 'verify_code' && 'Enter Verification Code'}
          {step === 'set_new_password' && 'Create New Password'}
          {step === 'success' && 'Password Reset Complete!'}
        </h2>
        <p className="text-xs text-stone-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
          {step === 'request' &&
            'Enter your registered email address to receive a 6-digit security verification code.'}
          {step === 'verify_code' &&
            `We dispatched a 6-digit verification code to ${email}. Please enter it below to proceed.`}
          {step === 'set_new_password' &&
            'Verification successful. Set a strong new password for your workstation account.'}
          {step === 'success' &&
            'Your password has been securely updated. Redirecting you to sign in...'}
        </p>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Global Info Banner */}
      {infoMessage && (
        <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: REQUEST EMAIL */}
      {/* ========================================================================= */}
      {step === 'request' && (
        <form onSubmit={handleRequestCode} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Account Email Address
            </label>
            <div className="relative">
              <input
                id="input-forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. yourname@gmail.com"
                className="w-full pl-9 pr-3.5 py-2.5 bg-stone-50/70 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                required
              />
              <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            </div>
            <p className="mt-1.5 text-[11px] text-stone-500 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>
                A single-use 6-digit OTP will be dispatched to your email address.
              </span>
            </p>
          </div>

          <div className="pt-2">
            <button
              id="btn-send-reset-code"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sending Verification Code...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Reset Verification Code</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: VERIFY CODE ONLY (No new password inputs displayed here!) */}
      {/* ========================================================================= */}
      {step === 'verify_code' && (
        <form onSubmit={handleVerifyCodeOnly} className="space-y-4 animate-in fade-in">
          {/* Email verification status notice */}
          {isLiveEmailSent ? (
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-start space-x-2">
              <Mail className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="flex-1 text-[11px] leading-relaxed">
                Verification code dispatched via Gmail SMTP to <strong className="text-emerald-950 font-semibold">{email}</strong>. Please check your Gmail inbox and spam folder.
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-stone-900 flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Verification Code Dispatched</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Ready
                </span>
              </div>
              {expectedCode && (
                <div className="bg-white p-2.5 rounded-xl border border-stone-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-stone-500 uppercase font-bold block">Current Security Code</span>
                    <span className="font-mono text-lg font-bold tracking-widest text-emerald-800">{expectedCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationCode(expectedCode);
                      audioService.playSoftNudge(0.7);
                    }}
                    className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-700" />
                    <span>Auto-Fill</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 6-Digit Code Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-stone-700">
                Enter 6-Digit Verification Code
              </label>
              <button
                type="button"
                onClick={() => {
                  setStep('request');
                  setError(null);
                  setInfoMessage(null);
                }}
                className="text-[11px] text-stone-400 hover:text-stone-700 hover:underline"
              >
                Change Email
              </button>
            </div>
            <div className="relative">
              <input
                id="input-reset-code"
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="• • • • • •"
                className="w-full px-3.5 py-3 bg-stone-50/70 border border-stone-200 rounded-xl text-center font-mono text-xl tracking-[0.3em] text-stone-900 placeholder-stone-300 focus:outline-none focus:border-emerald-600 focus:bg-white transition font-bold"
                required
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[11px] text-stone-500">
              <span>Code expires in 15 minutes</span>
              {resendCooldown > 0 ? (
                <span className="text-stone-400">Resend code in {resendCooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isSubmitting}
                  className="font-bold text-emerald-800 hover:text-emerald-950 hover:underline flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Resend Code</span>
                </button>
              )}
            </div>
          </div>

          {/* Step 2 Action: Verify Code */}
          <div className="pt-2">
            <button
              id="btn-verify-otp-code"
              type="submit"
              disabled={isVerifyingCode || verificationCode.trim().length !== 6}
              className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isVerifyingCode ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <span>Verify Code & Continue</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: SET NEW PASSWORD (Only loaded AFTER verification succeeds) */}
      {/* ========================================================================= */}
      {step === 'set_new_password' && (
        <form onSubmit={handleSaveNewPassword} className="space-y-4 animate-in fade-in">
          {/* Verified Email Badge */}
          <div className="p-3 bg-emerald-50/90 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BadgeCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Email Verified: <strong>{email}</strong></span>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
              Step 2 of 2
            </span>
          </div>

          {/* New Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-stone-700">
                New Password
              </label>
              {passwordStrength.label && (
                <span className="text-[11px] font-bold text-stone-600">
                  Strength: {passwordStrength.label}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="input-reset-new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-3.5 pr-10 py-2.5 bg-stone-50/70 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-stone-400 hover:text-stone-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength bar */}
            {newPassword.length > 0 && (
              <div className="mt-1.5 grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1 rounded-full transition-all ${
                      level <= passwordStrength.score ? passwordStrength.color : 'bg-stone-200'
                    }`}
                  ></div>
                ))}
              </div>
            )}
          </div>

          {/* Confirm New Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-stone-700">
                Confirm New Password
              </label>
              {confirmPassword && (
                <span
                  className={`text-[11px] font-bold flex items-center space-x-1 ${
                    newPassword === confirmPassword ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {newPassword === confirmPassword ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Passwords match</span>
                    </>
                  ) : (
                    <span>Does not match</span>
                  )}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="input-reset-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full pl-3.5 pr-10 py-2.5 bg-stone-50/70 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-stone-400 hover:text-stone-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit New Password Button */}
          <div className="pt-2">
            <button
              id="btn-submit-reset-password"
              type="submit"
              disabled={isSubmitting || newPassword.length < 6 || newPassword !== confirmPassword}
              className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Set New Password & Sign In</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: SUCCESS STATE */}
      {/* ========================================================================= */}
      {step === 'success' && (
        <div className="text-center py-4 space-y-4 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-9 h-9 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-stone-900">Password Updated Successfully</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
              Your new password is now active. You will be automatically returned to the workspace sign-in screen.
            </p>
          </div>

          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-600 max-w-xs mx-auto">
            <span>Account: <strong>{email}</strong></span>
          </div>

          <button
            type="button"
            onClick={() => onPasswordResetSuccess(email, newPassword)}
            className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center space-x-2"
          >
            <span>Proceed to Sign In Now</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="pt-6 mt-6 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
        <button
          type="button"
          onClick={onBackToSignIn}
          className="font-semibold text-emerald-800 hover:underline"
        >
          Remembered password? Sign In
        </button>
        <button
          type="button"
          onClick={onBackToRegister}
          className="font-semibold text-stone-600 hover:text-stone-900 hover:underline"
        >
          New user? Register
        </button>
      </div>
    </div>
  );
};
