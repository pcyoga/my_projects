import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  Info,
  Camera,
  Play,
  Square,
  Volume2,
  VolumeX,
  RefreshCw,
  Clock,
  Compass,
  Activity,
  Award,
  Calendar,
  Settings,
  User,
  LogOut,
  Mail,
  ChevronRight,
  Sparkles,
  Sliders,
  Bell,
  Check,
  X,
  Copy,
  ExternalLink,
  ChevronDown,
  Eye,
  Video,
  VideoOff,
  UserCheck,
  Sun,
  Maximize2,
  FileText,
  Download,
  Radio,
  Flame,
  Trophy,
  Crosshair
} from 'lucide-react';
import {
  UserProfile,
  BaselineProfile,
  PostureSession,
  PostureMetrics,
  UserGoal,
  NotificationPreferences,
  RegisteredUser,
  UserEmailLog,
  ActiveTab
} from './types';
import { Storage, defaultPreferences, defaultUserProfile, defaultBaseline, defaultGoals } from './utils/storage';
import { PoseDetector, ValidationStatus, PoseKeypoints } from './utils/poseDetector';
import { audioService } from './utils/audio';
import { emailService } from './utils/emailService';
import { PostureBadgesSection } from './components/PostureBadgesSection';
import { WeeklySummaryWidget } from './components/WeeklySummaryWidget';
import { ForgotPasswordModule } from './components/ForgotPasswordModule';
import { GamificationEngine } from './utils/gamification';
import { ThemeToggle } from './components/ThemeToggle';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  // Auth state
  const [authState, setAuthState] = useState(() => Storage.getAuthState());
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authOccupation, setAuthOccupation] = useState('Workstation User');
  const [authObjective, setAuthObjective] = useState('Maintain healthy spinal alignment');
  const [authError, setAuthError] = useState<string | null>(null);
  const [signupNotification, setSignupNotification] = useState<{
    title: string;
    message: string;
    email: string;
    fromAddress: string;
    replyTo: string;
  } | null>(null);

  // App navigation state
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [userProfile, setUserProfile] = useState<UserProfile>(() => Storage.getUserProfile());
  const [baseline, setBaseline] = useState<BaselineProfile | null>(() => Storage.getBaselineProfile());
  const [sessions, setSessions] = useState<PostureSession[]>(() => Storage.getSessions());
  const [goals, setGoals] = useState<UserGoal[]>(() => Storage.getGoals());
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => Storage.getPreferences());

  // Modals & UI toggles
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCameraPromptModalOpen, setIsCameraPromptModalOpen] = useState(false);
  const [isSetupRequiredModalOpen, setIsSetupRequiredModalOpen] = useState(false);
  const [isCalibCameraWarningModalOpen, setIsCalibCameraWarningModalOpen] = useState(false);

  // Live monitor state
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentScore, setCurrentScore] = useState(94);
  const [currentState, setCurrentState] = useState<'good' | 'warning' | 'poor'>('good');
  const [currentMetrics, setCurrentMetrics] = useState<PostureMetrics | null>(null);
  const [currentValidation, setCurrentValidation] = useState<ValidationStatus | null>(null);
  const [currentKeypoints, setCurrentKeypoints] = useState<PoseKeypoints | null>(null);
  const [simMode, setSimMode] = useState(false);
  const [simDeviation, setSimDeviation] = useState<'none' | 'forward_head' | 'shoulder_slump' | 'slouch'>('none');
  const [sessionDuration, setSessionDuration] = useState(0);
  const [alertsCount, setAlertsCount] = useState(0);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);

  // Calibration state
  const [calibStep, setCalibStep] = useState(1);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Stretches view state
  const [selectedStretchId, setSelectedStretchId] = useState('neck_roll');
  const [stretchTimer, setStretchTimer] = useState(0);
  const [isStretchTimerActive, setIsStretchTimerActive] = useState(false);

  // Refs for video & camera
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const calibVideoRef = useRef<HTMLVideoElement | null>(null);
  const detectorRef = useRef<PoseDetector | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // Mandatory calibration notification / prompt after login
  const [requiresInitialCalibration, setRequiresInitialCalibration] = useState(false);
  const [calibLiveFeedback, setCalibLiveFeedback] = useState<{
    headAngle: number;
    neckAngle: number;
    shoulderAngle: number;
    torsoAngle: number;
    distance: number;
    isValid: boolean;
    instruction: string;
    shoulderWidth?: number;
    earShoulderDist?: number;
    areShouldersVisible?: boolean;
    isHeadVisible?: boolean;
    leftShoulderDetected?: boolean;
    rightShoulderDetected?: boolean;
    shouldersLevel?: boolean;
    keypoints?: PoseKeypoints | null;
  }>({
    headAngle: 0.8,
    neckAngle: 3.5,
    shoulderAngle: 0.5,
    torsoAngle: 1.5,
    distance: 1.0,
    isValid: true,
    instruction: 'Sit upright facing screen with shoulders relaxed and visible',
    shoulderWidth: 0.42,
    earShoulderDist: 0.22,
    areShouldersVisible: true,
    isHeadVisible: true,
    leftShoulderDetected: true,
    rightShoulderDetected: true,
    shouldersLevel: true,
    keypoints: null
  });
  const [calibCameraActive, setCalibCameraActive] = useState(false);
  const [isCapturingCalibration, setIsCapturingCalibration] = useState(false);
  const [calibCountdown, setCalibCountdown] = useState<number | null>(null);

  // Manual Angle Fine-Tuning State
  const [tuneHeadAngle, setTuneHeadAngle] = useState(0.0);
  const [tuneNeckAngle, setTuneNeckAngle] = useState(3.5);
  const [tuneShoulderAngle, setTuneShoulderAngle] = useState(0.5);
  const [tuneTolerance, setTuneTolerance] = useState<'strict' | 'standard' | 'lenient'>('standard');
  const [shoulderOffsetVal, setShoulderOffsetVal] = useState(0.0);

  useEffect(() => {
    if (baseline) {
      setTuneHeadAngle(baseline.headAngle);
      setTuneNeckAngle(baseline.neckAngle);
      setTuneShoulderAngle(baseline.shoulderAngle);
      setTuneTolerance(baseline.toleranceLevel || 'standard');
    }
  }, [baseline]);

  // Gamification & Badges Engine
  const { badges, state: gamificationState } = useMemo(() => {
    return GamificationEngine.evaluateBadges(sessions, goals, baseline, userProfile?.id);
  }, [sessions, goals, baseline, userProfile?.id]);

  // Simulation helper to test badge unlock / streak progression
  const handleSimulateStreakAndScore = () => {
    const now = new Date();
    const simSessions: PostureSession[] = [
      {
        id: `ses_sim_${Date.now()}_1`,
        userId: userProfile.id,
        postureProfileId: baseline?.id || 'base_01',
        startTime: new Date(now.getTime() - 2 * 86400000).toISOString(),
        endTime: new Date(now.getTime() - 2 * 86400000 + 1800000).toISOString(),
        durationSeconds: 1800,
        averageScore: 94,
        goodSeconds: 1700,
        warningSeconds: 100,
        poorSeconds: 0,
        alertCount: 0,
        primaryDeviation: 'Optimal spinal balance'
      },
      {
        id: `ses_sim_${Date.now()}_2`,
        userId: userProfile.id,
        postureProfileId: baseline?.id || 'base_01',
        startTime: new Date(now.getTime() - 1 * 86400000).toISOString(),
        endTime: new Date(now.getTime() - 1 * 86400000 + 1800000).toISOString(),
        durationSeconds: 1800,
        averageScore: 96,
        goodSeconds: 1750,
        warningSeconds: 50,
        poorSeconds: 0,
        alertCount: 0,
        primaryDeviation: 'Optimal spinal balance'
      },
      {
        id: `ses_sim_${Date.now()}_3`,
        userId: userProfile.id,
        postureProfileId: baseline?.id || 'base_01',
        startTime: now.toISOString(),
        endTime: new Date(now.getTime() + 1800000).toISOString(),
        durationSeconds: 1800,
        averageScore: 98,
        goodSeconds: 1780,
        warningSeconds: 20,
        poorSeconds: 0,
        alertCount: 0,
        primaryDeviation: 'Optimal spinal balance'
      }
    ];

    simSessions.forEach((s) => Storage.saveSession(s, userProfile.id));
    setSessions(Storage.getSessions(userProfile.id));

    try {
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6']
      });
      audioService.playAlertSound();
    } catch {
      // ignore
    }
  };

  // Apply saved theme on mount
  useEffect(() => {
    Storage.applyTheme();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Initialize Pose Detector
  useEffect(() => {
    detectorRef.current = new PoseDetector();
    return () => {
      detectorRef.current?.stop();
    };
  }, []);

  // Attach video stream when element or camera status changes
  useEffect(() => {
    if (detectorRef.current) {
      if (videoRef.current && isCameraActive) {
        detectorRef.current.attachVideo(videoRef.current);
      }
      if (calibVideoRef.current && (calibCameraActive || isCameraActive)) {
        detectorRef.current.attachVideo(calibVideoRef.current);
      }
    }
  }, [isCameraActive, calibCameraActive, activeTab]);


  // --------------------------------------------------------------------------
  // AUTHENTICATION HANDLERS
  // --------------------------------------------------------------------------
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const email = authEmail.trim().toLowerCase();
    const password = authPassword.trim();

    if (!email || !password) {
      setAuthError('Please enter both your email address and password.');
      return;
    }

    const registered = Storage.findUserByEmail(email);
    let profileToUse: UserProfile;

    if (registered) {
      profileToUse = {
        id: registered.id,
        fullName: registered.fullName,
        email: registered.email,
        occupation: registered.occupation,
        computerUsageHours: registered.computerUsageHours,
        primaryActivity: registered.primaryActivity,
        breakFrequencyMinutes: registered.breakFrequencyMinutes,
        primaryObjective: registered.primaryObjective,
        hasCompletedOnboarding: registered.hasCompletedOnboarding,
        createdAt: registered.createdAt
      };
    } else {
      profileToUse = {
        id: `usr_${Date.now()}`,
        fullName: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
        email: email,
        occupation: 'Workstation User',
        computerUsageHours: 8,
        primaryActivity: 'general',
        breakFrequencyMinutes: 45,
        primaryObjective: 'Maintain healthy spinal alignment',
        hasCompletedOnboarding: true,
        createdAt: new Date().toISOString()
      };
      Storage.registerUser({
        ...profileToUse,
        passwordHash: 'sha256_mock_hash'
      });
    }

    const newAuthState = { isAuthenticated: true, user: profileToUse };
    Storage.setAuthState(newAuthState);
    setAuthState(newAuthState);
    setUserProfile(profileToUse);
    setAuthPassword('');

    // Trigger Python email_service notification for login event
    emailService.afterSuccessfulLogin(email).catch((err) => {
      console.warn('[Login Notice]', err);
    });

    // Load user's isolated data
    const userSessions = Storage.getSessions(profileToUse.id);
    const userBaseline = Storage.getBaselineProfile(profileToUse.id);
    const userGoals = Storage.getGoals(profileToUse.id);
    setSessions(userSessions);
    setBaseline(userBaseline);
    setGoals(userGoals);

    // Check if user has already completed posture calibration setup
    const hasBaseline = !!userBaseline;
    if (!hasBaseline) {
      setRequiresInitialCalibration(true);
      setActiveTab('dashboard');
    } else {
      setRequiresInitialCalibration(false);
      setActiveTab('dashboard');
    }
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const email = authEmail.trim().toLowerCase();
    const password = authPassword.trim();
    const name = authFullName.trim() || email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);

    if (!email || !password) {
      setAuthError('Email and password are required to create an account.');
      return;
    }

    // 1. Check whether the same email id is present in the system
    const existingUser = Storage.findUserByEmail(email);
    if (existingUser) {
      setAuthError('An account with this email address already exists. Please sign in instead or reset your password.');
      return;
    }

    // 2. Allow user creation
    const newRegisteredUser: RegisteredUser = {
      id: `usr_${Date.now()}`,
      fullName: name,
      email: email,
      passwordHash: 'sha256_mock_hash',
      occupation: authOccupation.trim() || 'Workstation User',
      computerUsageHours: 8,
      primaryActivity: 'general',
      breakFrequencyMinutes: 45,
      primaryObjective: authObjective.trim() || 'Maintain healthy spinal alignment',
      hasCompletedOnboarding: false,
      createdAt: new Date().toISOString()
    };
    Storage.registerUser(newRegisteredUser);
    Storage.initNewUser(newRegisteredUser.id);

    // 3. Dispatch signup confirmation and admin alert via Python email_service
    emailService.afterSuccessfulSignup(email).catch((err) => {
      console.warn('[Signup Notice]', err);
    });

    // 4. Go back to login screen instead of directly navigating to home/dashboard
    setAuthMode('signin');
    setAuthPassword(''); // Reset password field so user signs in
    setSignupNotification({
      title: 'Account Created Successfully!',
      message: `Your account for ${email} has been created. A confirmation email has been sent. Please enter your password to sign in.`,
      email: email,
      fromAddress: 'posturecareergonomics@gmail.com',
      replyTo: ''
    });
  };

  const handleLogout = () => {
    Storage.logout();
    setAuthState({ isAuthenticated: false, user: null });
    setIsUserMenuOpen(false);
    setRequiresInitialCalibration(false);
    stopMonitoring();
    stopCalibrationCamera();
  };

  // --------------------------------------------------------------------------
  // CAMERA & MONITORING CONTROLS
  // --------------------------------------------------------------------------
  // Called when user clicks "Start Live Monitoring"
  const requestStartMonitoring = () => {
    // Check if user has an active baseline profile setup
    const hasBaseline = Storage.hasCustomBaselineProfile(userProfile?.id);
    if (!hasBaseline || !baseline) {
      setRequiresInitialCalibration(true);
      setIsSetupRequiredModalOpen(true);
      return;
    }

    // If camera is not active yet and not currently simulating, prompt camera permission modal
    if (!isCameraActive && !simMode) {
      setIsCameraPromptModalOpen(true);
    } else {
      launchActiveSession();
    }
  };

  // Activate actual device camera through getUserMedia
  const handleEnableCamera = async () => {
    setCameraError(null);
    if (!detectorRef.current) return;

    try {
      const res = await detectorRef.current.startCamera(videoRef.current || null);
      if (res.success) {
        if (videoRef.current) {
          detectorRef.current.attachVideo(videoRef.current);
        }
        setIsCameraActive(true);
        setIsCameraPromptModalOpen(false);
        launchActiveSession();
      } else {
        setCameraError(res.error || 'Camera permission was denied or device not found.');
      }
    } catch (err) {
      setCameraError('Unable to open camera stream. You can enable simulation mode below.');
    }
  };

  // Fallback to simulation mode directly from modal
  const handleEnableSimulation = () => {
    setSimMode(true);
    setIsCameraPromptModalOpen(false);
    if (detectorRef.current) {
      detectorRef.current.setSimulated(true, 'none');
    }
    setIsCameraActive(true);
    launchActiveSession();
  };

  const launchActiveSession = () => {
    setIsMonitoring(true);
    setSessionDuration(0);
    setAlertsCount(0);

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    timerIntervalRef.current = window.setInterval(() => {
      setSessionDuration(prev => prev + 1);
    }, 1000);

    if (detectorRef.current) {
      if (simMode) {
        detectorRef.current.setSimulated(true, simDeviation);
      }
      detectorRef.current.startDetection(baseline, (metrics, keypoints, validation) => {
        setCurrentMetrics(metrics);
        setCurrentScore(metrics.postureScore);
        setCurrentState(metrics.state);
        setCurrentValidation(validation);
        setCurrentKeypoints(keypoints);

        if (metrics.state === 'poor') {
          setAlertBanner('Poor posture detected: Please gently align cervical spine over shoulders.');
        } else if (metrics.state === 'warning') {
          setAlertBanner('Mild forward tilt detected: Relax shoulders.');
        } else {
          setAlertBanner(null);
        }
      });
    }
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    setIsCameraActive(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    detectorRef.current?.stop();
    setCurrentValidation(null);
    setAlertBanner(null);

    // Save session if lasted > 10 seconds so user sees it in dashboard and history
    if (sessionDuration > 10) {
      const now = new Date();
      const goodSec = Math.round(sessionDuration * (currentScore / 100));
      const poorSec = Math.round(sessionDuration * ((100 - currentScore) / 100));
      const newSession: PostureSession = {
        id: `ses_${Date.now()}`,
        userId: userProfile.id,
        postureProfileId: baseline?.id || 'base_01',
        startTime: new Date(now.getTime() - sessionDuration * 1000).toISOString(),
        endTime: now.toISOString(),
        durationSeconds: sessionDuration,
        averageScore: Math.max(60, currentScore),
        goodSeconds: goodSec,
        warningSeconds: Math.max(0, sessionDuration - goodSec - poorSec),
        poorSeconds: poorSec,
        alertCount: alertsCount,
        primaryDeviation: currentMetrics && Math.abs(currentMetrics.neckAngle) > 8
          ? 'Forward neck inclination'
          : (currentMetrics && Math.abs(currentMetrics.shoulderAngle) > 4
            ? 'Lateral shoulder tilt'
            : 'Optimal spinal balance')
      };
      Storage.saveSession(newSession, userProfile.id);
      setSessions(Storage.getSessions(userProfile.id));

      if (newSession.averageScore >= 90) {
        try {
          confetti({
            particleCount: 75,
            spread: 65,
            origin: { y: 0.6 },
            colors: ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6']
          });
          audioService.playAlertSound();
        } catch {
          // ignore
        }
      }
    }
    setSessionDuration(0);
    setAlertsCount(0);
  };

  // Calibration Camera Controls
  const startCalibrationCamera = async () => {
    setCameraError(null);
    if (!detectorRef.current) return;
    try {
      setCalibCameraActive(true);
      await new Promise(resolve => setTimeout(resolve, 60));
      const res = await detectorRef.current.startCamera(calibVideoRef.current || null);
      if (res.success) {
        if (calibVideoRef.current) {
          detectorRef.current.attachVideo(calibVideoRef.current);
        }
        // Start continuous live posture calculation for calibration studio
        detectorRef.current.startDetection(null, (metrics, keypoints, validation) => {
          let instruction = 'Hold this upright posture still (ears over shoulders)';
          let isValid = true;

          if (!validation.isPersonDetected) {
            instruction = 'Center yourself: Position head and shoulders in view';
            isValid = false;
          } else if (!validation.isLightingAdequate) {
            instruction = 'Improve room lighting facing your display';
            isValid = false;
          } else if (!validation.areShouldersVisible) {
            instruction = 'Step back slightly: Ensure both shoulders are fully in frame';
            isValid = false;
          } else if (validation.shouldersLevel === false) {
            instruction = `Level your shoulders (tilted by ${Math.abs(metrics.shoulderAngle).toFixed(1)}°)`;
            isValid = false;
          } else if (Math.abs(metrics.headAngle) > 12) {
            instruction = 'Level your head horizontally';
            isValid = false;
          }

          const currentEarDist = (
            Math.hypot(keypoints.leftEar.x - keypoints.leftShoulder.x, keypoints.leftEar.y - keypoints.leftShoulder.y) +
            Math.hypot(keypoints.rightEar.x - keypoints.rightShoulder.x, keypoints.rightEar.y - keypoints.rightShoulder.y)
          ) / 2;

          setCalibLiveFeedback({
            headAngle: Number(metrics.headAngle.toFixed(1)),
            neckAngle: Number(metrics.neckAngle.toFixed(1)),
            shoulderAngle: Number(metrics.shoulderAngle.toFixed(1)),
            torsoAngle: Number(metrics.torsoAngle.toFixed(1)),
            distance: Number(metrics.cameraDistance.toFixed(2)),
            isValid,
            instruction,
            shoulderWidth: validation.shoulderWidth ?? 0.42,
            earShoulderDist: Number(currentEarDist.toFixed(2)),
            areShouldersVisible: validation.areShouldersVisible,
            isHeadVisible: validation.isHeadVisible,
            leftShoulderDetected: validation.leftShoulderDetected,
            rightShoulderDetected: validation.rightShoulderDetected,
            shouldersLevel: validation.shouldersLevel,
            keypoints
          });
        });
      } else {
        setCameraError(res.error || 'Camera permission denied or camera device unavailable.');
      }
    } catch {
      setCameraError('Unable to open camera stream. Calibration can also run in simulated mode.');
    }
  };

  const stopCalibrationCamera = () => {
    setCalibCameraActive(false);
    setIsCapturingCalibration(false);
    setCalibCountdown(null);
    if (!isMonitoring) {
      detectorRef.current?.stop();
    }
  };

  const captureCalibrationBaseline = () => {
    // If camera is off, prompt user to enable the camera first
    if (!calibCameraActive) {
      setIsCalibCameraWarningModalOpen(true);
      return;
    }

    setIsCapturingCalibration(true);
    setCalibCountdown(3);
    audioService.playSoftNudge(0.9);

    const countdownTimer = window.setInterval(() => {
      setCalibCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownTimer);
          finalizeCalibrationBaseline();
          return null;
        }
        audioService.playSoftNudge(0.9);
        return prev - 1;
      });
    }, 1000);
  };

  const finalizeCalibrationBaseline = (customProfile?: Partial<BaselineProfile>) => {
    if (!userProfile) return;

    const captured = detectorRef.current ? detectorRef.current.captureCurrentAngles() : {
      headAngle: calibLiveFeedback.headAngle,
      neckAngle: calibLiveFeedback.neckAngle,
      shoulderAngle: calibLiveFeedback.shoulderAngle,
      torsoAngle: calibLiveFeedback.torsoAngle,
      cameraDistance: calibLiveFeedback.distance,
      shoulderWidth: calibLiveFeedback.shoulderWidth || 0.42,
      earShoulderDist: calibLiveFeedback.earShoulderDist || 0.22
    };

    const newBase: BaselineProfile = {
      id: `base_${Date.now()}`,
      userId: userProfile.id,
      name: customProfile?.name || `${userProfile.fullName}'s Calibrated Baseline`,
      headAngle: customProfile?.headAngle ?? Math.round(captured.headAngle * 10) / 10,
      neckAngle: customProfile?.neckAngle ?? Math.round(captured.neckAngle * 10) / 10,
      shoulderAngle: customProfile?.shoulderAngle ?? Math.round(captured.shoulderAngle * 10) / 10,
      torsoAngle: customProfile?.torsoAngle ?? Math.round(captured.torsoAngle * 10) / 10,
      cameraDistance: customProfile?.cameraDistance ?? Math.round(captured.cameraDistance * 10) / 10,
      shoulderWidth: customProfile?.shoulderWidth ?? captured.shoulderWidth ?? 0.42,
      earShoulderDist: customProfile?.earShoulderDist ?? captured.earShoulderDist ?? 0.22,
      toleranceLevel: customProfile?.toleranceLevel || tuneTolerance || 'standard',
      calibratedAt: new Date().toISOString(),
      isActive: true
    };

    Storage.saveBaselineProfile(newBase, userProfile.id);
    setBaseline(newBase);
    setTuneHeadAngle(newBase.headAngle);
    setTuneNeckAngle(newBase.neckAngle);
    setTuneShoulderAngle(newBase.shoulderAngle);
    setTuneTolerance(newBase.toleranceLevel);
    setIsCapturingCalibration(false);
    setRequiresInitialCalibration(false);
    audioService.playSuccessChime();
    setCalibStep(3);
  };

  // Stretch exercise definitions
  const stretchesList = [
    {
      id: 'neck_roll',
      title: 'Upper Trapezius & Neck Release',
      target: 'Cervical Spine & Neck',
      duration: 30,
      reps: '3 reps per side',
      instructions: [
        'Sit tall with your shoulders relaxed downward and resting gently.',
        'Gently tilt your right ear toward your right shoulder without forcing.',
        'Hold for 15 seconds, feeling a soothing release along the side of your neck.',
        'Smoothly repeat on the left side.'
      ]
    },
    {
      id: 'chest_opener',
      title: 'Doorway & Seated Chest Opener',
      target: 'Pectorals & Anterior Shoulders',
      duration: 45,
      reps: '2 reps',
      instructions: [
        'Interlace your fingers comfortably behind your lower back or rest hands on armrests.',
        'Gently draw your shoulder blades together and lift your chest softly.',
        'Take 3 deep, steady diaphragmatic breaths.',
        'Release gently without snapping or jarring the shoulders.'
      ]
    },
    {
      id: 'seated_twist',
      title: 'Seated Gentle Spinal Twist',
      target: 'Thoracic Spine & Lumbar',
      duration: 40,
      reps: '2 reps per side',
      instructions: [
        'Sit upright with both feet resting flat on the ground.',
        'Place your right hand on the chair back and your left hand on your right knee.',
        'Smoothly rotate your torso toward the right, looking naturally over your shoulder.',
        'Hold for 20 seconds, breathe steadily, then switch to the left.'
      ]
    },
    {
      id: 'chin_tuck',
      title: 'Ergonomic Chin Tucks',
      target: 'Deep Cervical Flexors',
      duration: 30,
      reps: '10 reps (3s hold)',
      instructions: [
        'Look straight ahead with relaxed jaw muscles.',
        'Draw your chin straight backward gently as if creating a subtle double chin.',
        'Hold for 3 seconds, feeling the lengthening at the base of your skull.',
        'Release back to natural neutral position.'
      ]
    }
  ];

  // --------------------------------------------------------------------------
  // RENDER AUTH SCREEN (WHEN NOT LOGGED IN) - SOFTER PALETTE
  // --------------------------------------------------------------------------
  if (!authState.isAuthenticated) {
    return (
      <div id="auth-page" className="min-h-screen bg-[#FDFBF7] text-stone-800 flex flex-col justify-between font-['Plus_Jakarta_Sans',sans-serif]">
        {/* Soft Minimal Header */}
        <header id="auth-header" className="px-6 py-4 flex items-center justify-between border-b border-stone-200/70 bg-[#FDFBF7]/90 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center text-lg font-bold shadow-sm shadow-emerald-800/10">
              🧘
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-stone-900 tracking-tight">PostureCare</span>
                <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200/80">
                  Spine Health
                </span>
              </div>
              <p className="text-xs text-stone-500 font-normal">Gentle Real-Time Workstation Ergonomics</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Privacy Badge */}
            <div className="flex items-center space-x-1.5 text-xs text-emerald-800 bg-emerald-50/90 border border-emerald-200/80 px-3 py-1.5 rounded-xl font-medium">
              <Shield className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">100% On-Device Privacy</span>
              <span className="sm:hidden">Private</span>
            </div>
          </div>
        </header>

        {/* Soft Auth Card */}
        <main id="auth-container" className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
          <div className="w-full max-w-md bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-sm">
            {/* Header Tabs */}
            {authMode !== 'forgot' && (
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-3 text-xl border border-emerald-100">
                  ✨
                </div>
                <h2 className="text-2xl font-bold text-stone-900 tracking-tight">
                  {authMode === 'signin' ? 'Welcome Back' : 'Create Your Account'}
                </h2>
                <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                  {authMode === 'signin'
                    ? 'Sign in to access your calibrated ergonomic workspace'
                    : 'Start real-time posture tracking and preventative spine care'}
                </p>
              </div>
            )}

            {/* Mode Toggle Switch */}
            {authMode !== 'forgot' && (
              <div className="flex p-1 bg-stone-100/80 rounded-2xl mb-6 border border-stone-200/70">
                <button
                  id="tab-signin-toggle"
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setAuthError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    authMode === 'signin'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Sign In
                </button>
                <button
                  id="tab-signup-toggle"
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    authMode === 'signup'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Register
                </button>
              </div>
            )}

            {/* Signup Success / Confirmation Notification */}
            {signupNotification && authMode === 'signin' && (
              <div id="signup-confirmation-banner" className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-stone-800 text-xs flex flex-col gap-1.5">
                <div className="flex items-center space-x-2 font-bold text-emerald-900">
                  <CheckCircle className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                  <span>{signupNotification.title}</span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  {signupNotification.message}
                </p>
              </div>
            )}

            {/* Error Message */}
            {authError && (
              <div id="auth-error-alert" className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Form */}
            {authMode === 'forgot' ? (
              <ForgotPasswordModule
                initialEmail={authEmail}
                onBackToSignIn={() => {
                  setAuthMode('signin');
                  setAuthError(null);
                }}
                onBackToRegister={() => {
                  setAuthMode('signup');
                  setAuthError(null);
                }}
                onPasswordResetSuccess={(resetEmail, newPwd) => {
                  setAuthEmail(resetEmail);
                  setAuthPassword(newPwd);
                  setAuthMode('signin');
                  setSignupNotification({
                    title: 'Password Successfully Reset',
                    message: `Your account password for ${resetEmail} has been updated. You can now sign in with your new credentials.`,
                    email: resetEmail,
                    fromAddress: '',
                    replyTo: ''
                  });
                }}
              />
            ) : authMode === 'signin' ? (
              <form id="signin-form" onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="input-signin-email"
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="e.g. user@workspace.local"
                    className="w-full px-3.5 py-2.5 bg-stone-50/70 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-stone-700">
                      Password
                    </label>
                    <button
                      type="button"
                      id="btn-forgot-password"
                      onClick={() => {
                        setAuthMode('forgot');
                        setAuthError(null);
                      }}
                      className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="input-signin-password"
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-stone-50/70 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                    required
                  />
                </div>

                <div className="pt-2">
                  <button
                    id="btn-submit-signin"
                    type="submit"
                    className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center space-x-2"
                  >
                    <span>Sign In to Workspace</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-2 text-center text-xs text-stone-500">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setAuthError(null);
                    }}
                    className="text-emerald-700 font-bold hover:underline"
                  >
                    Create one here
                  </button>
                </div>
              </form>
            ) : (
              <form id="signup-form" onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="input-signup-name"
                    type="text"
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full px-3.5 py-2 bg-stone-50/70 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Email Address <span className="text-emerald-700">*</span>
                  </label>
                  <input
                    id="input-signup-email"
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="e.g. alex@company.com"
                    className="w-full px-3.5 py-2 bg-stone-50/70 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                    required
                  />
                  <p className="mt-1 text-[11px] text-stone-500">
                    A welcome confirmation will be sent to your email address.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Password <span className="text-emerald-700">*</span>
                  </label>
                  <input
                    id="input-signup-password"
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Create a secure password"
                    className="w-full px-3.5 py-2 bg-stone-50/70 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Primary Occupation
                  </label>
                  <select
                    id="input-signup-occupation"
                    value={authOccupation}
                    onChange={(e) => setAuthOccupation(e.target.value)}
                    className="w-full px-3.5 py-2 bg-stone-50/70 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  >
                    <option value="Software Engineer">Software Engineer</option>
                    <option value="Data Analyst / Scientist">Data Analyst / Scientist</option>
                    <option value="Product / UI Designer">Product / UI Designer</option>
                    <option value="Remote Knowledge Worker">Remote Knowledge Worker</option>
                    <option value="Student / Academic">Student / Academic</option>
                    <option value="Workstation User">General Workstation User</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    id="btn-submit-signup"
                    type="submit"
                    className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center space-x-2"
                  >
                    <span>Create Account & Send Confirmation</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-2 text-center text-xs text-stone-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setAuthError(null);
                    }}
                    className="text-emerald-700 font-bold hover:underline"
                  >
                    Sign in here
                  </button>
                </div>
              </form>
            )}
          </div>
        </main>

        {/* Soft Footer */}
        <footer id="auth-footer" className="px-4 sm:px-6 py-4 border-t border-stone-200/70 text-center text-xs text-stone-500">
          PostureCare Spine Health • Educational tool powered by On-Device Ergonomic Computer Vision
        </footer>

      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER MAIN APPLICATION (AFTER LOGIN) - SOFTER WARM PALETTE
  // --------------------------------------------------------------------------
  return (
    <div id="posturecare-app" className="min-h-screen bg-[#FDFBF7] text-stone-800 flex flex-col justify-between font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Soft Main Top Navigation */}
      <header id="main-nav-bar" className="bg-white/95 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer shrink-0" onClick={() => setActiveTab('dashboard')}>
            <div className="w-9 h-9 rounded-2xl bg-emerald-700 text-white flex items-center justify-center text-base font-bold shadow-sm shrink-0">
              🧘
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 tracking-tight">PostureCare</span>
                <span className="hidden 2xl:inline-block text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800/80">
                  Spine Guard
                </span>
              </div>
              <p className="hidden 2xl:block text-[11px] text-stone-500">Ergonomic Posture Workspace</p>
            </div>
          </div>

          {/* Center Navigation Tabs (Visible on Extra Large Screens) */}
          <nav className="hidden xl:flex items-center space-x-1 min-w-0 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Activity },
              { id: 'monitor', label: 'Live Monitor', icon: Camera },
              { id: 'calibrate', label: 'Calibration', icon: Compass },
              { id: 'history', label: 'History & Trends', icon: Calendar },
              { id: 'goals', label: 'Goals', icon: Award },
              { id: 'stretches', label: 'Desk Stretches', icon: Sparkles }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100/70 dark:hover:bg-stone-800/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Header Controls with Profile & Logout - ALWAYS VISIBLE WITH SHRINK-0 */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0 ml-auto z-20">
            {/* Gamification Streak & Level Badges (on 2xl screens) */}
            {gamificationState.currentStreakDays > 0 && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className="hidden 2xl:inline-flex items-center space-x-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 rounded-xl text-xs font-bold shadow-2xs transition shrink-0"
                title={`${gamificationState.currentStreakDays}-day consecutive streak active! Click to view Badges.`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                <span>{gamificationState.currentStreakDays}d streak</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('dashboard')}
              className="hidden 2xl:inline-flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/90 rounded-xl text-xs font-bold shadow-2xs transition shrink-0"
              title={`Level ${gamificationState.level} ${gamificationState.levelTitle} (${gamificationState.totalXp} XP)`}
            >
              <Trophy className="w-3.5 h-3.5 text-emerald-700" />
              <span>Lvl {gamificationState.level}</span>
            </button>

            {/* Prominent User Profile Icon & Menu with Theme & Settings inside - ALWAYS VISIBLE */}
            <div className="relative shrink-0" ref={userMenuRef}>
              <button
                id="user-menu-trigger"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 px-2.5 sm:px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 shadow-2xs transition shrink-0"
                title="User Profile & Theme Settings"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <span className="hidden sm:inline font-medium max-w-[100px] xl:max-w-[130px] truncate text-stone-800 dark:text-stone-200">
                  {userProfile.fullName || 'User Profile'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              </button>

              {isUserMenuOpen && (
                <div
                  id="user-menu-dropdown"
                  className="absolute right-0 mt-2 w-72 bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 p-2.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
                >
                  {/* User Profile Header */}
                  <div className="px-3 py-2.5 border-b border-stone-100 dark:border-stone-800 mb-2 bg-stone-50/80 dark:bg-stone-800/50 rounded-xl flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-bold text-stone-900 dark:text-stone-100 truncate">{userProfile.fullName || 'User Profile'}</p>
                      <p className="text-stone-500 dark:text-stone-400 truncate text-[11px]">{userProfile.email}</p>
                      <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded mt-1 inline-block border border-emerald-200/60 dark:border-emerald-800/60">
                        {userProfile.occupation || 'Workstation User'}
                      </span>
                    </div>
                  </div>

                  {/* THEME SETTINGS UNDER USER ICON */}
                  <div className="p-3 mb-2 bg-stone-50/80 dark:bg-stone-800/50 rounded-2xl border border-stone-200/80 dark:border-stone-700/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-stone-800 dark:text-stone-200 flex items-center space-x-1.5">
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>Theme Settings</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 capitalize">
                        {Storage.getTheme()}
                      </span>
                    </div>
                    <ThemeToggle variant="segmented" className="w-full justify-between" />
                  </div>

                  {/* Settings Link */}
                  <button
                    id="user-menu-settings-btn"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsSettingsOpen(true);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 flex items-center space-x-2.5 transition font-semibold"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                      <Settings className="w-4 h-4" />
                    </div>
                    <span className="flex-1">Settings & Preferences</span>
                    <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                  </button>

                  {/* Review Doc Link */}
                  <a
                    href="/PostureCare_Review_1_Documentation.docx"
                    download="PostureCare_Review_1_Documentation.docx"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center space-x-2.5 transition font-medium"
                  >
                    <FileText className="w-4 h-4 text-emerald-700" />
                    <span className="flex-1">Review – I Word Doc</span>
                    <Download className="w-3.5 h-3.5 text-stone-400" />
                  </a>

                  <div className="border-t border-stone-100 dark:border-stone-800 my-1"></div>

                  {/* Log Out */}
                  <button
                    id="btn-logout"
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400 flex items-center space-x-2.5 font-bold transition"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>Log Out of Workspace</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Viewport Content */}
      <main id="active-viewport" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full">
        {/* Navigation Bar for Mobile */}
        {/* Responsive Navigation Bar for Tablet, Laptop & Mobile (below 1280px) */}
        <div className="xl:hidden flex items-center overflow-x-auto gap-1.5 mb-6 pb-2 no-scrollbar">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'monitor', label: 'Live Monitor' },
            { id: 'calibrate', label: 'Calibration' },
            { id: 'history', label: 'History & Trends' },
            { id: 'goals', label: 'Goals' },
            { id: 'stretches', label: 'Desk Stretches' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition shrink-0 ${
                activeTab === tab.id
                  ? 'bg-emerald-700 text-white shadow-2xs font-bold'
                  : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Animated Screen Switcher */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full"
          >
            {/* TAB 1: DASHBOARD */}
            {activeTab === 'dashboard' && (() => {
          const totalDurationSec = sessions.reduce((acc, s) => acc + s.durationSeconds, 0);
          const totalHours = Math.floor(totalDurationSec / 3600);
          const totalMins = Math.floor((totalDurationSec % 3600) / 60);
          const formattedTotalTime = totalDurationSec > 0 ? (totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`) : '0m';
          const avgScore = sessions.length > 0 
            ? Math.round(sessions.reduce((acc, s) => acc + s.averageScore, 0) / sessions.length) 
            : null;
          const totalAlerts = sessions.reduce((acc, s) => acc + s.alertCount, 0);
          const isNewUserDashboard = sessions.length === 0;
          const isBaselineConfigured = !!baseline && Storage.hasCustomBaselineProfile(userProfile?.id);

          return (
            <div id="view-dashboard" className="space-y-6">
              {/* Top Prompt Banner for Initial Setup / Calibration */}
              {(!isBaselineConfigured || requiresInitialCalibration) && (
                <div id="initial-calibration-prompt-banner" className="bg-gradient-to-r from-emerald-950 via-stone-900 to-emerald-900 text-white rounded-3xl p-6 shadow-md border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 animate-in fade-in">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                      <span className="text-[11px] font-bold tracking-wider uppercase text-amber-300">Initial Setup Required</span>
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      Welcome{userProfile ? `, ${userProfile.fullName}` : ''}! Set Up Your Neck & Shoulder Baseline
                    </h3>
                    <p className="text-xs text-stone-300 leading-relaxed">
                      Before starting live monitoring, PostureCare needs to capture your neutral reference positions for neck alignment and shoulder level. This ensures on-device computer vision accurately detects your true posture.
                    </p>
                    <div className="pt-2 flex flex-wrap gap-2 text-xs">
                      <span className="px-3 py-1 bg-white/10 rounded-xl border border-white/15 text-stone-200">
                        👤 <strong>Neck Alignment:</strong> Ears stacked over shoulders, chin level
                      </span>
                      <span className="px-3 py-1 bg-white/10 rounded-xl border border-white/15 text-stone-200">
                        📐 <strong>Shoulder Balance:</strong> Level shoulders rolled back and down
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto flex-shrink-0">
                    <button
                      id="btn-initiate-setup-dashboard"
                      onClick={() => {
                        setActiveTab('calibrate');
                        setCalibStep(1);
                      }}
                      className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Calibrate Neck & Shoulders</span>
                    </button>
                    <button
                      onClick={requestStartMonitoring}
                      className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition flex items-center justify-center space-x-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Live Monitoring</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Top Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
                    <span>Posture Alignment Score</span>
                    {isNewUserDashboard ? (
                      <span className="text-stone-600 bg-stone-100 px-2 py-0.5 rounded font-medium text-[11px]">No sessions yet</span>
                    ) : (
                      <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-100">+4% vs baseline</span>
                    )}
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-bold text-stone-900">{isNewUserDashboard ? '—' : `${avgScore}%`}</span>
                    <span className="text-xs text-stone-500 font-medium">{isNewUserDashboard ? 'Complete first session' : 'Optimal balance'}</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1.5 mt-3">
                    <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: isNewUserDashboard ? '0%' : `${avgScore}%` }}></div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
                    <span>Good Posture Time</span>
                    <span className="text-stone-500">{isNewUserDashboard ? '0% recorded' : '78% of session'}</span>
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-bold text-stone-900">{isNewUserDashboard ? '0m' : formattedTotalTime}</span>
                    <span className="text-xs text-stone-500 font-medium">{isNewUserDashboard ? 'No recorded time' : 'Recorded'}</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1.5 mt-3">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: isNewUserDashboard ? '0%' : '78%' }}></div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
                    <span>Forward Slump Alerts</span>
                    <span className="text-stone-500 text-[11px]">{isNewUserDashboard ? 'Clean status' : '-2 vs avg'}</span>
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-bold text-stone-900">{isNewUserDashboard ? '0' : totalAlerts}</span>
                    <span className="text-xs text-stone-500 font-medium">{isNewUserDashboard ? 'No alerts triggered' : 'Micro-events'}</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1.5 mt-3">
                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: isNewUserDashboard ? '0%' : '25%' }}></div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
                    <span>Active Baseline</span>
                    <span className={`font-bold ${isBaselineConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {isBaselineConfigured ? 'Calibrated' : 'Setup Required'}
                    </span>
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-lg font-bold text-stone-900 truncate">
                      {isBaselineConfigured && baseline ? baseline.name : 'Not Calibrated'}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('calibrate')}
                    className="mt-3 text-xs font-bold text-emerald-800 hover:text-emerald-900 flex items-center space-x-1"
                  >
                    <span>{isBaselineConfigured ? 'Recalibrate baseline' : 'Provide initial posture'}</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Quick Actions Banner */}
              <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 text-white px-2.5 py-1 rounded-full border border-white/20">
                    Real-Time Computer Vision
                  </span>
                  <h3 className="text-xl font-bold mt-2">Ready to monitor your ergonomic posture?</h3>
                  <p className="text-emerald-100/90 text-xs mt-1 max-w-xl leading-relaxed">
                    PostureCare tracks cervical spine angle, forward head tilt, and shoulder symmetry with on-device posture validation.
                  </p>
                </div>
                <div className="flex items-center space-x-3 w-full md:w-auto">
                  <button
                    id="btn-quick-launch-monitor"
                    onClick={() => {
                      setActiveTab('monitor');
                      requestStartMonitoring();
                    }}
                    className="w-full md:w-auto px-5 py-2.5 bg-white text-emerald-900 hover:bg-stone-50 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-2xs transition"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start Live Monitoring</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('stretches')}
                    className="w-full md:w-auto px-4 py-2.5 bg-emerald-900/60 hover:bg-emerald-900/80 text-white border border-white/20 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Quick Stretch</span>
                  </button>
                </div>
              </div>

              {/* Weekly Summary Widget powered by Recharts */}
              <WeeklySummaryWidget
                sessions={sessions}
                onStartMonitoring={() => {
                  setActiveTab('monitor');
                  requestStartMonitoring();
                }}
                onNavigateToGoals={() => setActiveTab('goals')}
                isNewUser={isNewUserDashboard}
              />

              {/* Goals & Micro-Habits Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active Goals Card */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-stone-200/90 p-6 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-bold text-stone-900">Active Ergonomic Goals</h4>
                        <p className="text-xs text-stone-500">Track progress toward daily and weekly spinal posture targets</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('goals')}
                        className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 hover:underline flex items-center space-x-1"
                      >
                        <span>Manage Goals</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {goals.slice(0, 3).map((g) => (
                        <div key={g.id} className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/70 text-xs flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                              <span className="capitalize font-semibold">{g.category} Target</span>
                              <span className="text-emerald-800 font-bold">
                                {Math.min(100, Math.round((g.currentValue / g.targetValue) * 100))}%
                              </span>
                            </div>
                            <h5 className="font-bold text-stone-800 line-clamp-2">{g.title}</h5>
                          </div>
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-stone-600 mb-1">
                              <span>Progress</span>
                              <span>{g.currentValue} / {g.targetValue} {g.unit}</span>
                            </div>
                            <div className="w-full bg-stone-200/80 rounded-full h-1.5">
                              <div
                                className="bg-emerald-600 h-1.5 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (g.currentValue / g.targetValue) * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                    <span>Streak: <strong>{isNewUserDashboard ? '0 Days (New User)' : `${gamificationState.currentStreakDays} Days Active`}</strong></span>
                    <span className="text-emerald-800 font-bold">{isNewUserDashboard ? 'Ready to Start' : `Level ${gamificationState.level} • ${gamificationState.levelTitle}`}</span>
                  </div>
                </div>

                {/* Quick Ergonomic Habit Card */}
                <div className="bg-gradient-to-br from-stone-900 to-stone-950 text-white rounded-3xl p-6 shadow-2xs flex flex-col justify-between border border-stone-800">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase tracking-wider border border-emerald-500/30">
                        20-20-20 Rule
                      </span>
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h4 className="text-base font-bold text-white">Posture Micro-Breaks</h4>
                    <p className="text-xs text-stone-300 mt-2 leading-relaxed">
                      Every 20 minutes of desk work, look at an object 20 feet away for 20 seconds, roll your shoulders back, and perform a cervical retraction.
                    </p>
                  </div>
                  <div className="pt-4 border-t border-stone-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-stone-400">Reduce spinal fatigue</span>
                    <button
                      onClick={() => setActiveTab('stretches')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1"
                    >
                      <span>Stretch Routine</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Gamification & Visual Badges Section */}
              <PostureBadgesSection
                badges={badges}
                gamificationState={gamificationState}
                onRefreshBadges={() => {
                  setSessions(Storage.getSessions(userProfile?.id));
                }}
                onNavigateToTab={(tab) => {
                  setActiveTab(tab);
                  if (tab === 'calibrate') setCalibStep(1);
                  if (tab === 'monitor') requestStartMonitoring();
                }}
                onSimulateStreak={handleSimulateStreakAndScore}
              />
            </div>
          );
        })()}

        {/* TAB 2: LIVE MONITOR & VALIDATION */}
        {activeTab === 'monitor' && (
          <div id="view-monitor" className="space-y-6">
            <div className="bg-white rounded-3xl border border-stone-200/90 p-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-stone-900">Live Ergonomic Monitoring Studio</h3>
                    {isMonitoring && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                        Live Tracking
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Calculates head tilt, cervical angle, and shoulder slump with posture validation.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {!isMonitoring ? (
                    <button
                      id="btn-start-monitoring"
                      onClick={requestStartMonitoring}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-2xs transition"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start Live Monitoring</span>
                    </button>
                  ) : (
                    <button
                      id="btn-stop-monitoring"
                      onClick={stopMonitoring}
                      className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-2xs transition"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span>Stop Monitoring</span>
                    </button>
                  )}
                  <button
                    onClick={() => audioService.playSoftNudge(0.7)}
                    className="p-2 bg-stone-100 hover:bg-stone-200/80 text-stone-700 rounded-xl border border-stone-200 text-xs font-bold"
                    title="Test Audio Chime"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Real-Time Posture Alert Banner */}
              {alertBanner && (
                <div className="mt-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center space-x-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span className="font-medium">{alertBanner}</span>
                </div>
              )}

              {/* Monitor Layout */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Visual Viewport */}
                <div
                  onClick={(e) => {
                    if (!isCameraActive || simMode) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = (e.clientX - rect.left) / rect.width;
                    const clickY = (e.clientY - rect.top) / rect.height;
                    detectorRef.current?.setManualAnchor(clickX, clickY);
                  }}
                  className="lg:col-span-2 bg-stone-900 rounded-3xl relative aspect-video min-h-[260px] sm:min-h-[340px] max-h-[500px] flex items-center justify-center overflow-hidden border border-stone-800 shadow-inner cursor-crosshair group"
                  title="Click anywhere on the video to snap posture tracking directly to your seated position"
                >
                  {/* Real Video Element if Camera Active */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isCameraActive && !simMode ? 'block' : 'hidden'}`}
                  />

                  {/* Wireframe Overlay & Simulation Avatar */}
                  {isMonitoring ? (
                    <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
                      {/* Real-time Skeletal Joints & Shoulder Clavicle Overlay */}
                      {isCameraActive && currentKeypoints && (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {/* Face Tracking Bounding Indicator */}
                          {currentValidation?.detectedFaceBounds && (
                            <rect
                              x={(currentValidation.detectedFaceBounds.x - currentValidation.detectedFaceBounds.width / 2) * 100}
                              y={(currentValidation.detectedFaceBounds.y - currentValidation.detectedFaceBounds.height / 2) * 100}
                              width={currentValidation.detectedFaceBounds.width * 100}
                              height={currentValidation.detectedFaceBounds.height * 100}
                              rx="3"
                              fill="none"
                              stroke="rgba(52, 211, 153, 0.45)"
                              strokeWidth="1.2"
                              strokeDasharray="2.5 2.5"
                            />
                          )}

                          {/* Clavicle Line connecting shoulders */}
                          <line
                            x1={currentKeypoints.leftShoulder.x * 100}
                            y1={currentKeypoints.leftShoulder.y * 100}
                            x2={currentKeypoints.rightShoulder.x * 100}
                            y2={currentKeypoints.rightShoulder.y * 100}
                            stroke={currentState === 'good' ? '#10b981' : currentState === 'warning' ? '#f59e0b' : '#f43f5e'}
                            strokeWidth="2.8"
                          />
                          {/* Cervical Spine Vector */}
                          <line
                            x1={currentKeypoints.neck.x * 100}
                            y1={currentKeypoints.neck.y * 100}
                            x2={currentKeypoints.midShoulder.x * 100}
                            y2={currentKeypoints.midShoulder.y * 100}
                            stroke="#38bdf8"
                            strokeWidth="2.2"
                            strokeDasharray="2 2"
                          />
                          {/* Nose to Neck */}
                          <line
                            x1={currentKeypoints.nose.x * 100}
                            y1={currentKeypoints.nose.y * 100}
                            x2={currentKeypoints.neck.x * 100}
                            y2={currentKeypoints.neck.y * 100}
                            stroke="#10b981"
                            strokeWidth="1.8"
                          />
                          {/* Left Shoulder Node */}
                          <circle
                            cx={currentKeypoints.leftShoulder.x * 100}
                            cy={currentKeypoints.leftShoulder.y * 100}
                            r="3.8"
                            fill="#10b981"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                          />
                          {/* Right Shoulder Node */}
                          <circle
                            cx={currentKeypoints.rightShoulder.x * 100}
                            cy={currentKeypoints.rightShoulder.y * 100}
                            r="3.8"
                            fill="#10b981"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                          />
                          {/* Neck Node */}
                          <circle
                            cx={currentKeypoints.neck.x * 100}
                            cy={currentKeypoints.neck.y * 100}
                            r="3.0"
                            fill="#38bdf8"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                          />
                          {/* Nose Node */}
                          <circle
                            cx={currentKeypoints.nose.x * 100}
                            cy={currentKeypoints.nose.y * 100}
                            r="2.8"
                            fill="#34d399"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                          />
                        </svg>
                      )}

                      {/* Top Bar with Corner Telemetry & Calibration Anchors */}
                      <div className="flex items-center justify-between z-10">
                        <div className="font-mono text-[10px] text-stone-200 bg-stone-900/90 px-3 py-1.5 rounded-xl border border-stone-800 shadow-sm flex items-center space-x-3">
                          <span>Duration: {Math.floor(sessionDuration / 60)}m {sessionDuration % 60}s</span>
                          <span className="text-stone-500">•</span>
                          <span>Alerts: {alertsCount}</span>
                          {currentMetrics && (
                            <>
                              <span className="text-stone-500">•</span>
                              <span className="text-emerald-400">Shoulder: {currentMetrics.shoulderAngle > 0 ? `+${currentMetrics.shoulderAngle}` : currentMetrics.shoulderAngle}°</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              detectorRef.current?.setManualAnchor(0.50, 0.42);
                              detectorRef.current?.setShoulderOffset(0);
                            }}
                            className="pointer-events-auto bg-stone-900/90 hover:bg-stone-800 text-stone-200 hover:text-white px-2.5 py-1.5 rounded-xl border border-stone-700 text-[10px] font-bold flex items-center space-x-1.5 transition shadow-sm"
                            title="Reset tracking to center sitting position"
                          >
                            <Crosshair className="w-3 h-3 text-emerald-400" />
                            <span>Center on Me</span>
                          </button>

                          <div className="font-mono text-xs font-bold text-emerald-400 bg-stone-900/90 px-3 py-1.5 rounded-xl border border-stone-800 shadow-sm flex items-center space-x-1.5">
                            <span>Score:</span>
                            <span className="text-emerald-300">{currentScore}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Simulation mode center avatar if video is not live */}
                      {(!isCameraActive || simMode) && (
                        <div className="self-center my-auto flex flex-col items-center justify-center text-center">
                          <div className={`w-28 h-28 rounded-full border-4 ${
                            currentState === 'good' ? 'border-emerald-500 shadow-emerald-500/30' :
                            currentState === 'warning' ? 'border-amber-500 shadow-amber-500/30' : 'border-rose-500 shadow-rose-500/30'
                          } flex items-center justify-center transition-all shadow-lg bg-stone-900/80 mb-2`}>
                            <span className="text-3xl">🧘</span>
                          </div>
                          <span className="text-xs text-stone-300 font-medium">Posture Simulator Active</span>
                        </div>
                      )}

                      {/* Bottom Status Pill */}
                      <div className="self-center z-10 bg-stone-900/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-stone-700 shadow-md">
                        <div className="flex items-center space-x-2 text-xs">
                          <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                            currentState === 'good' ? 'bg-emerald-400' :
                            currentState === 'warning' ? 'bg-amber-400' : 'bg-rose-400'
                          }`}></span>
                          <span className="font-mono text-emerald-300">
                            Status: {currentState === 'good' ? 'Optimal Upright Posture' : currentState === 'warning' ? 'Mild Correction Needed' : 'Spinal / Shoulder Slouch Detected'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8 text-stone-400">
                      <Camera className="w-12 h-12 mx-auto mb-3 text-stone-600" />
                      <h4 className="text-sm font-bold text-stone-200">Vision Monitoring Standby</h4>
                      <p className="text-xs text-stone-400 max-w-sm mt-1">
                        Click 'Start Live Monitoring' to activate camera tracking against your calibrated neck & shoulder posture.
                      </p>
                    </div>
                  )}
                </div>

                {/* Side Controls & Validation Status */}
                <div className="space-y-4">
                  {/* Posture Validation Box */}
                  <div className="bg-stone-50 rounded-2xl border border-stone-200/90 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                        <UserCheck className="w-4 h-4 text-emerald-700" />
                        <span>Posture Validation</span>
                      </h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        currentValidation?.isPersonDetected
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-200 text-stone-600'
                      }`}>
                        {currentValidation?.isPersonDetected ? 'Subject In View' : 'Awaiting Detection'}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-stone-200/70">
                        <span className="text-stone-500">Person Centered:</span>
                        <span className={`font-semibold ${currentValidation?.isCentered ? 'text-emerald-700' : 'text-stone-600'}`}>
                          {currentValidation ? (currentValidation.isCentered ? '✓ Centered' : 'Off-center') : 'Optimal'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-stone-200/70">
                        <span className="text-stone-500">Shoulders Visible:</span>
                        <span className={`font-semibold ${currentValidation?.areShouldersVisible ? 'text-emerald-700' : 'text-stone-600'}`}>
                          {currentValidation ? (currentValidation.areShouldersVisible ? '✓ Visible' : 'Obscured') : '✓ Clear'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-stone-200/70">
                        <span className="text-stone-500">Lighting Quality:</span>
                        <span className="font-semibold text-emerald-700 flex items-center space-x-1">
                          <Sun className="w-3 h-3 text-amber-500" />
                          <span>Adequate</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-stone-500">Posture Stability:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {currentValidation?.stabilityScore ?? 92}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Posture Telemetry */}
                  <div className="bg-stone-50 rounded-2xl border border-stone-200/90 p-4">
                    <h4 className="text-xs font-bold text-stone-900 mb-2">Posture Telemetry</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-stone-200/70">
                        <span className="text-stone-500">Cervical Spine Angle:</span>
                        <span className="font-mono font-bold text-stone-800">
                          {currentMetrics ? `${currentMetrics.neckAngle.toFixed(1)}°` : '14.2°'} (Target: &lt; 20°)
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/70">
                        <span className="text-stone-500">Shoulder Level:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {currentMetrics ? `${currentMetrics.shoulderAngle.toFixed(1)}°` : '0.8°'} Balanced
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-stone-500">Distance Ratio:</span>
                        <span className="font-mono font-bold text-stone-800">
                          {currentMetrics ? currentMetrics.cameraDistance.toFixed(2) : '1.02'} (Calibrated)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ergonomic Simulator Box */}
                  <div className="bg-stone-50 rounded-2xl border border-stone-200/90 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-stone-900">Posture Simulator</h4>
                      <label className="flex items-center cursor-pointer text-[11px] text-stone-600 font-medium">
                        <input
                          type="checkbox"
                          checked={simMode}
                          onChange={(e) => {
                            setSimMode(e.target.checked);
                            if (detectorRef.current) {
                              detectorRef.current.setSimulated(e.target.checked, 'none');
                            }
                          }}
                          className="mr-1.5 rounded text-emerald-600"
                        />
                        Simulate
                      </label>
                    </div>
                    <p className="text-[11px] text-stone-500 mb-3">
                      Test alert chimes and triggers without changing posture.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        onClick={() => {
                          setCurrentScore(95);
                          setCurrentState('good');
                          setAlertBanner(null);
                        }}
                        className="py-1.5 px-2 bg-white hover:bg-emerald-50 border border-stone-200 rounded-xl font-medium text-emerald-800 transition"
                      >
                        Upright Posture
                      </button>
                      <button
                        onClick={() => {
                          setCurrentScore(68);
                          setCurrentState('warning');
                          audioService.playSoftNudge(0.5);
                          setAlertsCount(prev => prev + 1);
                          setAlertBanner('Forward head tilt detected: Return chin to neutral.');
                        }}
                        className="py-1.5 px-2 bg-white hover:bg-amber-50 border border-stone-200 rounded-xl font-medium text-amber-800 transition"
                      >
                        Forward Head Tilt
                      </button>
                      <button
                        onClick={() => {
                          setCurrentScore(52);
                          setCurrentState('poor');
                          audioService.playAlertTone(0.8);
                          setAlertsCount(prev => prev + 1);
                          setAlertBanner('Persistent shoulder slouch detected: Sit upright.');
                        }}
                        className="py-1.5 px-2 bg-white hover:bg-rose-50 border border-stone-200 rounded-xl font-medium text-rose-800 transition"
                      >
                        Shoulder Slouch
                      </button>
                      <button
                        onClick={() => audioService.playBreakChime(0.6)}
                        className="py-1.5 px-2 bg-white hover:bg-teal-50 border border-stone-200 rounded-xl font-medium text-teal-800 transition"
                      >
                        Break Prompt
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CALIBRATION STUDIO */}
        {activeTab === 'calibrate' && (
          <div id="view-calibrate" className="space-y-6">
            {/* Mandatory setup banner when redirected right after login */}
            {requiresInitialCalibration && (
              <div id="mandatory-calibration-alert" className="p-4 rounded-3xl bg-amber-50 border border-amber-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-start space-x-3">
                  <div className="w-9 h-9 rounded-2xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">Mandatory Initial Posture Calibration Required</h4>
                    <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                      Welcome to PostureCare! Please take your neutral upright posture position now. We will calibrate your natural skeletal angles so future live monitoring can accurately detect slumping and forward head tilt.
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className="px-3 py-1 rounded-xl bg-amber-200/70 text-amber-900 text-[11px] font-bold">
                    Step 1 of 3: Align Posture
                  </span>
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl border border-stone-200/90 p-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
                <div>
                  <h3 className="text-base font-bold text-stone-900">Guided Ergonomic Baseline Calibration</h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Set your personalized upright reference angle to ensure accurate detection throughout your workday.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {!calibCameraActive ? (
                    <button
                      id="btn-start-calib-camera"
                      onClick={startCalibrationCamera}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-2xs transition"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Turn On Webcam Preview</span>
                    </button>
                  ) : (
                    <button
                      id="btn-stop-calib-camera"
                      onClick={stopCalibrationCamera}
                      className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition border border-stone-200"
                    >
                      <VideoOff className="w-4 h-4" />
                      <span>Pause Webcam</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Steps Header */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className={`p-3 rounded-2xl border transition ${
                  calibStep === 1 ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950' : 'bg-stone-50 border-stone-200/70 text-stone-500'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      calibStep > 1 ? 'bg-emerald-700 text-white' : calibStep === 1 ? 'bg-emerald-700 text-white' : 'bg-stone-300 text-stone-700'
                    }`}>
                      {calibStep > 1 ? '✓' : '1'}
                    </span>
                    <span className="text-xs font-bold">Ergonomic Setup</span>
                  </div>
                  <p className="text-[11px] mt-1 text-stone-500 hidden sm:block">Screen height & seat posture</p>
                </div>

                <div className={`p-3 rounded-2xl border transition ${
                  calibStep === 2 ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950' : 'bg-stone-50 border-stone-200/70 text-stone-500'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      calibStep > 2 ? 'bg-emerald-700 text-white' : calibStep === 2 ? 'bg-emerald-700 text-white' : 'bg-stone-300 text-stone-700'
                    }`}>
                      {calibStep > 2 ? '✓' : '2'}
                    </span>
                    <span className="text-xs font-bold">Posture Position</span>
                  </div>
                  <p className="text-[11px] mt-1 text-stone-500 hidden sm:block">Align ears over shoulders</p>
                </div>

                <div className={`p-3 rounded-2xl border transition ${
                  calibStep === 3 ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950' : 'bg-stone-50 border-stone-200/70 text-stone-500'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      Storage.hasCustomBaselineProfile(userProfile?.id) ? 'bg-emerald-700 text-white' : 'bg-stone-300 text-stone-700'
                    }`}>
                      3
                    </span>
                    <span className="text-xs font-bold">Lock Baseline</span>
                  </div>
                  <p className="text-[11px] mt-1 text-stone-500 hidden sm:block">Store profile for monitoring</p>
                </div>
              </div>

              {/* Main Calibration Interactive Layout */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Left: Camera Feed or Interactive Guide */}
                <div className="space-y-4">
                  <div
                    onClick={(e) => {
                      if (!calibCameraActive) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = (e.clientX - rect.left) / rect.width;
                      const clickY = (e.clientY - rect.top) / rect.height;
                      detectorRef.current?.setManualAnchor(clickX, clickY);
                    }}
                    className="bg-stone-900 rounded-3xl aspect-video relative flex items-center justify-center overflow-hidden border border-stone-800 shadow-inner cursor-crosshair group"
                    title="Click anywhere on the video to snap posture tracking directly to your seated position"
                  >
                    <video
                      ref={calibVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover absolute inset-0"
                    />

                    {!calibCameraActive && (
                      <div className="absolute inset-0 bg-stone-900/95 z-10 p-8 flex flex-col items-center justify-center text-center text-white space-y-3">
                        <div className="w-16 h-16 rounded-2xl bg-stone-800/80 border border-stone-700 flex items-center justify-center mx-auto text-2xl text-emerald-400">
                          📷
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-stone-200">Camera Preview Standby</h4>
                          <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                            Enable your camera for live posture angle calculations and skeletal alignment tracking.
                          </p>
                        </div>
                        <button
                          onClick={startCalibrationCamera}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-2xs transition"
                        >
                          Activate Webcam Now
                        </button>
                      </div>
                    )}

                    {/* Live Alignment Overlay when camera is active */}
                    {calibCameraActive && (
                      <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between bg-black/30 backdrop-blur-2xs">
                        {/* Status bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <div className="bg-stone-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-stone-700 text-xs flex items-center space-x-2 text-white shadow-sm">
                              <span className={`w-2 h-2 rounded-full animate-pulse ${calibLiveFeedback.isValid ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                              <span>{calibLiveFeedback.instruction}</span>
                            </div>

                            {/* Dual Face & Shoulder Detection Chips */}
                            <div className="hidden sm:flex items-center space-x-1.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                                calibLiveFeedback.isHeadVisible
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                                  : 'bg-stone-800 text-stone-400 border-stone-700'
                              }`}>
                                Head: {calibLiveFeedback.isHeadVisible ? '✓' : '—'}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                                calibLiveFeedback.areShouldersVisible
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                                  : 'bg-amber-950/80 text-amber-300 border-amber-700'
                              }`}>
                                Shoulders: {calibLiveFeedback.areShouldersVisible ? 'Both In View ✓' : 'Adjust View'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                detectorRef.current?.setManualAnchor(0.50, 0.42);
                                detectorRef.current?.setShoulderOffset(0);
                              }}
                              className="pointer-events-auto bg-stone-900/90 hover:bg-stone-800 text-stone-200 hover:text-white px-2.5 py-1 rounded-xl border border-stone-700 text-[10px] font-bold flex items-center space-x-1 transition shadow-sm"
                              title="Reset tracking to center sitting position"
                            >
                              <Crosshair className="w-3 h-3 text-emerald-400" />
                              <span>Center on Me</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (detectorRef.current) {
                                  detectorRef.current.setHeadTiltCalibrationOffset(calibLiveFeedback.headAngle);
                                }
                              }}
                              className="pointer-events-auto bg-stone-900/90 hover:bg-stone-800 text-emerald-300 hover:text-white px-2 py-1 rounded-xl border border-emerald-800/80 text-[10px] font-bold flex items-center space-x-1 transition shadow-sm"
                              title="Set current head roll to 0.0° level"
                            >
                              <span>Zero 0.0° Tilt</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (detectorRef.current) {
                                  const cur = detectorRef.current.getShoulderOffset();
                                  detectorRef.current.setShoulderOffset(cur - 0.03);
                                }
                              }}
                              className="pointer-events-auto bg-stone-900/90 hover:bg-stone-800 text-stone-300 hover:text-white px-2 py-1 rounded-xl border border-stone-700 text-[10px] font-bold transition shadow-sm"
                              title="Nudge shoulder line higher"
                            >
                              ▲ Shoulders
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (detectorRef.current) {
                                  const cur = detectorRef.current.getShoulderOffset();
                                  detectorRef.current.setShoulderOffset(cur + 0.03);
                                }
                              }}
                              className="pointer-events-auto bg-stone-900/90 hover:bg-stone-800 text-stone-300 hover:text-white px-2 py-1 rounded-xl border border-stone-700 text-[10px] font-bold transition shadow-sm"
                              title="Nudge shoulder line lower"
                            >
                              ▼ Shoulders
                            </button>
                            <div className={`px-2.5 py-1 rounded-xl text-[10px] font-bold font-mono border ${
                              Math.abs(calibLiveFeedback.shoulderAngle) <= 3.5
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                                : 'bg-amber-950/80 text-amber-300 border-amber-700'
                            }`}>
                              Shoulder: {calibLiveFeedback.shoulderAngle > 0 ? `+${calibLiveFeedback.shoulderAngle}` : calibLiveFeedback.shoulderAngle}°
                            </div>
                          </div>
                        </div>

                        {/* Full-Frame Interactive Skeletal & Shoulder SVG Guide covering 100% of video */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {/* Fallback silhouette if no camera detection yet */}
                          {!calibLiveFeedback.keypoints && (
                            <g>
                              <ellipse
                                cx="50"
                                cy="42"
                                rx="13"
                                ry="16"
                                fill="none"
                                stroke="rgba(16, 185, 129, 0.45)"
                                strokeWidth="1.2"
                                strokeDasharray="2 2"
                              />
                              <line
                                x1="20"
                                y1="76"
                                x2="80"
                                y2="76"
                                stroke="rgba(16, 185, 129, 0.35)"
                                strokeWidth="1.2"
                                strokeDasharray="3 3"
                              />
                              <circle cx="22" cy="76" r="4.5" fill="none" stroke="rgba(16, 185, 129, 0.5)" strokeWidth="1" />
                              <circle cx="78" cy="76" r="4.5" fill="none" stroke="rgba(16, 185, 129, 0.5)" strokeWidth="1" />
                            </g>
                          )}

                          {/* Live Detected Skeletal Joints & Clavicle Bar if Keypoints Available */}
                          {calibLiveFeedback.keypoints && (
                            <g>
                              {/* Face Bounding Box Guide */}
                              <rect
                                x={(calibLiveFeedback.keypoints.nose.x - 0.12) * 100}
                                y={(calibLiveFeedback.keypoints.nose.y - 0.16) * 100}
                                width="24"
                                height="28"
                                rx="4"
                                fill="none"
                                stroke="rgba(52, 211, 153, 0.45)"
                                strokeWidth="1.2"
                                strokeDasharray="2.5 2.5"
                              />

                              {/* Clavicle bar connecting left and right shoulders */}
                              <line
                                x1={calibLiveFeedback.keypoints.leftShoulder.x * 100}
                                y1={calibLiveFeedback.keypoints.leftShoulder.y * 100}
                                x2={calibLiveFeedback.keypoints.rightShoulder.x * 100}
                                y2={calibLiveFeedback.keypoints.rightShoulder.y * 100}
                                stroke={
                                  Math.abs(calibLiveFeedback.shoulderAngle) <= 3.5
                                    ? '#10b981'
                                    : Math.abs(calibLiveFeedback.shoulderAngle) <= 6.0
                                    ? '#f59e0b'
                                    : '#f43f5e'
                                }
                                strokeWidth="3"
                              />

                              {/* Cervical Spine Vector from neck to mid-shoulder */}
                              <line
                                x1={calibLiveFeedback.keypoints.neck.x * 100}
                                y1={calibLiveFeedback.keypoints.neck.y * 100}
                                x2={calibLiveFeedback.keypoints.midShoulder.x * 100}
                                y2={calibLiveFeedback.keypoints.midShoulder.y * 100}
                                stroke="#38bdf8"
                                strokeWidth="2.2"
                                strokeDasharray="2 2"
                              />

                              {/* Nose to Neck Line */}
                              <line
                                x1={calibLiveFeedback.keypoints.nose.x * 100}
                                y1={calibLiveFeedback.keypoints.nose.y * 100}
                                x2={calibLiveFeedback.keypoints.neck.x * 100}
                                y2={calibLiveFeedback.keypoints.neck.y * 100}
                                stroke="#10b981"
                                strokeWidth="2"
                              />

                              {/* Left Shoulder Joint Node */}
                              <circle
                                cx={calibLiveFeedback.keypoints.leftShoulder.x * 100}
                                cy={calibLiveFeedback.keypoints.leftShoulder.y * 100}
                                r="4"
                                fill="#10b981"
                                stroke="#ffffff"
                                strokeWidth="1.4"
                              />
                              <text
                                x={calibLiveFeedback.keypoints.leftShoulder.x * 100}
                                y={calibLiveFeedback.keypoints.leftShoulder.y * 100 - 3.5}
                                fill="#34d399"
                                fontSize="2.8"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                L-Shoulder
                              </text>

                              {/* Right Shoulder Joint Node */}
                              <circle
                                cx={calibLiveFeedback.keypoints.rightShoulder.x * 100}
                                cy={calibLiveFeedback.keypoints.rightShoulder.y * 100}
                                r="4"
                                fill="#10b981"
                                stroke="#ffffff"
                                strokeWidth="1.4"
                              />
                              <text
                                x={calibLiveFeedback.keypoints.rightShoulder.x * 100}
                                y={calibLiveFeedback.keypoints.rightShoulder.y * 100 - 3.5}
                                fill="#34d399"
                                fontSize="2.8"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                R-Shoulder
                              </text>

                              {/* Neck Node */}
                              <circle
                                cx={calibLiveFeedback.keypoints.neck.x * 100}
                                cy={calibLiveFeedback.keypoints.neck.y * 100}
                                r="3.2"
                                fill="#38bdf8"
                                stroke="#ffffff"
                                strokeWidth="1.4"
                              />
                              <text
                                x={calibLiveFeedback.keypoints.neck.x * 100}
                                y={calibLiveFeedback.keypoints.neck.y * 100 - 3}
                                fill="#38bdf8"
                                fontSize="2.4"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                Cervical Neck
                              </text>

                              {/* Nose Node */}
                              <circle
                                cx={calibLiveFeedback.keypoints.nose.x * 100}
                                cy={calibLiveFeedback.keypoints.nose.y * 100}
                                r="3"
                                fill="#34d399"
                                stroke="#ffffff"
                                strokeWidth="1.4"
                              />
                            </g>
                          )}
                        </svg>

                        {/* Live Angle & Shoulder Readouts Grid */}
                        <div className="bg-stone-900/90 backdrop-blur-md p-2.5 rounded-2xl border border-stone-800 text-[11px] grid grid-cols-4 gap-2 text-center text-stone-300 z-10">
                          <div>
                            <div className="text-stone-400 text-[10px]">Head Tilt</div>
                            <div className="font-bold text-white">{calibLiveFeedback.headAngle}°</div>
                          </div>
                          <div>
                            <div className="text-stone-400 text-[10px]">Neck Angle</div>
                            <div className="font-bold text-white">{calibLiveFeedback.neckAngle}°</div>
                          </div>
                          <div>
                            <div className="text-stone-400 text-[10px]">Shoulder Level</div>
                            <div className={`font-bold ${Math.abs(calibLiveFeedback.shoulderAngle) <= 3.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {calibLiveFeedback.shoulderAngle}°
                            </div>
                          </div>
                          <div>
                            <div className="text-stone-400 text-[10px]">Shoulder Span</div>
                            <div className="font-bold text-white">
                              {calibLiveFeedback.shoulderWidth ? (calibLiveFeedback.shoulderWidth * 100).toFixed(0) + '%' : '42%'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Countdown Overlay */}
                    {calibCountdown !== null && (
                      <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20 animate-in fade-in">
                        <div className="text-6xl font-black font-mono text-emerald-400 animate-bounce">
                          {calibCountdown}
                        </div>
                        <p className="text-sm font-bold mt-2">Hold your posture still...</p>
                        <p className="text-xs text-stone-400 mt-1">Locking head & shoulder baseline vectors</p>
                      </div>
                    )}
                  </div>

                  {/* Ergonomic Posture Checklist */}
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/70 space-y-2 text-xs">
                    <h5 className="font-bold text-stone-900">Posture Alignment Checklist:</h5>
                    <div className="flex items-center space-x-2 text-stone-600">
                      <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                      <span>Back supported against chair backrest with hips pushed back</span>
                    </div>
                    <div className="flex items-center space-x-2 text-stone-600">
                      <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                      <span>Both shoulders relaxed downward and visible within the frame</span>
                    </div>
                    <div className="flex items-center space-x-2 text-stone-600">
                      <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                      <span>Ears aligned horizontally directly over your clavicle and shoulders</span>
                    </div>
                    <div className="flex items-center space-x-2 text-stone-600">
                      <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                      <span>Eyes level with the top 1/3 of your display monitor</span>
                    </div>
                  </div>
                </div>

                {/* Right: Steps & Capture Action */}
                <div className="space-y-4">
                  {/* Active Baseline Status Card */}
                  <div className="bg-stone-900 text-white p-6 rounded-3xl border border-stone-800 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xl">
                          🎯
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">Posture Baseline Status</h4>
                          <p className="text-xs text-stone-400">
                            {Storage.hasCustomBaselineProfile(userProfile?.id)
                              ? 'Custom profile calibrated and active'
                              : 'No baseline set — system requires setup'}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        Storage.hasCustomBaselineProfile(userProfile?.id)
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                          : 'bg-amber-950/80 text-amber-300 border-amber-700'
                      }`}>
                        {Storage.hasCustomBaselineProfile(userProfile?.id) ? 'Calibrated' : 'Setup Required'}
                      </span>
                    </div>

                    {baseline && (
                      <div className="p-3.5 bg-stone-800/80 rounded-2xl border border-stone-700 text-xs space-y-1.5 text-stone-300 mb-5">
                        <div className="flex justify-between">
                          <span className="text-stone-400">Profile Name:</span>
                          <span className="font-medium text-white">{baseline.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Target Head Tilt:</span>
                          <span className="font-mono text-emerald-400">±{baseline.headAngle}°</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Target Neck Alignment:</span>
                          <span className="font-mono text-emerald-400">{baseline.neckAngle}°</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Calibrated Shoulder Level:</span>
                          <span className="font-mono text-emerald-400">{baseline.shoulderAngle}° (Level)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Resting Shoulder Width:</span>
                          <span className="font-mono text-emerald-400">
                            {baseline.shoulderWidth ? `${(baseline.shoulderWidth * 100).toFixed(0)}% span` : '42% span'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Ear-Shoulder Vertical Span:</span>
                          <span className="font-mono text-emerald-400">
                            {baseline.earShoulderDist ? `${(baseline.earShoulderDist * 100).toFixed(0)}% span` : '22% span'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Big Action Button */}
                    <div className="space-y-3">
                      <button
                        id="btn-capture-posture-position"
                        onClick={captureCalibrationBaseline}
                        disabled={isCapturingCalibration}
                        className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-2xl shadow-sm transition disabled:opacity-50 flex items-center justify-center space-x-2"
                      >
                        {isCapturingCalibration ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Capturing Reference Posture (Hold Still)...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Take Posture Position & Lock Baseline</span>
                          </>
                        )}
                      </button>

                      {Storage.hasCustomBaselineProfile(userProfile?.id) && (
                        <button
                          id="btn-proceed-to-monitoring"
                          onClick={() => {
                            setActiveTab('monitor');
                            requestStartMonitoring();
                          }}
                          className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-2xl transition flex items-center justify-center space-x-2 border border-stone-700"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Start Live Monitoring</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Precision Angle Calibration & Fine-Tuning Studio */}
                  <div className="bg-white rounded-3xl border border-stone-200/90 p-5 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <Sliders className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-stone-900">Precision Angle Calibration</h5>
                          <p className="text-[10px] text-stone-500">Fine-tune individual ergonomic axes or adopt live stream values</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        calibCameraActive ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                      }`}>
                        {calibCameraActive ? '● Camera Live' : '○ Standby'}
                      </span>
                    </div>

                    {/* Quick Live Stream Sync Button */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTuneHeadAngle(calibLiveFeedback.headAngle);
                          setTuneNeckAngle(calibLiveFeedback.neckAngle);
                          setTuneShoulderAngle(calibLiveFeedback.shoulderAngle);
                          finalizeCalibrationBaseline({
                            headAngle: calibLiveFeedback.headAngle,
                            neckAngle: calibLiveFeedback.neckAngle,
                            shoulderAngle: calibLiveFeedback.shoulderAngle,
                            shoulderWidth: calibLiveFeedback.shoulderWidth,
                            earShoulderDist: calibLiveFeedback.earShoulderDist,
                            toleranceLevel: tuneTolerance
                          });
                        }}
                        className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-xl border border-emerald-200/80 transition flex items-center justify-center space-x-1.5"
                      >
                        <Compass className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Adopt Live Camera Angles</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTuneHeadAngle(0.0);
                          setTuneNeckAngle(3.5);
                          setTuneShoulderAngle(0.0);
                          setTuneTolerance('standard');
                          finalizeCalibrationBaseline({
                            headAngle: 0.0,
                            neckAngle: 3.5,
                            shoulderAngle: 0.0,
                            shoulderWidth: 0.42,
                            earShoulderDist: 0.22,
                            toleranceLevel: 'standard'
                          });
                        }}
                        className="py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold rounded-xl transition flex items-center space-x-1"
                        title="Reset baseline to neutral 0.0° / 3.5° / 0.0° standard"
                      >
                        <RefreshCw className="w-3 h-3 text-stone-500" />
                        <span>Reset Neutral</span>
                      </button>
                    </div>

                    {/* Axis 1: Head Roll Angle */}
                    <div className="space-y-1.5 bg-stone-50 p-3 rounded-2xl border border-stone-200/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-700">Head Roll Tilt:</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-stone-900">
                            {tuneHeadAngle > 0 ? `+${tuneHeadAngle.toFixed(1)}° (Right)` : tuneHeadAngle < 0 ? `${tuneHeadAngle.toFixed(1)}° (Left)` : '0.0° (Level)'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              detectorRef.current?.setHeadTiltCalibrationOffset(calibLiveFeedback.headAngle);
                              setTuneHeadAngle(0.0);
                            }}
                            className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-md transition shadow-2xs"
                            title="Zero out camera angle tilt to exact 0.0° neutral"
                          >
                            Zero 0.0°
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setTuneHeadAngle(prev => Math.round((prev - 0.5) * 10) / 10)}
                          className="w-6 h-6 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold text-xs flex items-center justify-center hover:bg-stone-100"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="-15"
                          max="15"
                          step="0.5"
                          value={tuneHeadAngle}
                          onChange={(e) => setTuneHeadAngle(parseFloat(e.target.value))}
                          className="flex-1 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                        <button
                          type="button"
                          onClick={() => setTuneHeadAngle(prev => Math.round((prev + 0.5) * 10) / 10)}
                          className="w-6 h-6 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold text-xs flex items-center justify-center hover:bg-stone-100"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex justify-between text-[10px] text-stone-400">
                        <span>-15° Left</span>
                        <span className="text-emerald-700 font-medium">0° Neutral</span>
                        <span>+15° Right</span>
                      </div>
                    </div>

                    {/* Axis 2: Cervical Spine / Neck Flexion */}
                    <div className="space-y-1.5 bg-stone-50 p-3 rounded-2xl border border-stone-200/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-700">Neck / Cervical Flexion:</span>
                        <span className="font-mono font-bold text-stone-900">
                          {tuneNeckAngle.toFixed(1)}° forward
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setTuneNeckAngle(prev => Math.max(0, Math.round((prev - 0.5) * 10) / 10))}
                          className="w-6 h-6 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold text-xs flex items-center justify-center hover:bg-stone-100"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="25"
                          step="0.5"
                          value={tuneNeckAngle}
                          onChange={(e) => setTuneNeckAngle(parseFloat(e.target.value))}
                          className="flex-1 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                        <button
                          type="button"
                          onClick={() => setTuneNeckAngle(prev => Math.min(25, Math.round((prev + 0.5) * 10) / 10))}
                          className="w-6 h-6 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold text-xs flex items-center justify-center hover:bg-stone-100"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex justify-between text-[10px] text-stone-400">
                        <span>0° Vertical</span>
                        <span className="text-emerald-700 font-medium">3.5° Neutral</span>
                        <span>25° Flexed</span>
                      </div>
                    </div>

                    {/* Axis 3: Shoulder Bilateral Level */}
                    <div className="space-y-1.5 bg-stone-50 p-3 rounded-2xl border border-stone-200/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-700">Shoulder Bilateral Level:</span>
                        <span className="font-mono font-bold text-stone-900">
                          {tuneShoulderAngle > 0 ? `+${tuneShoulderAngle.toFixed(1)}° (R lower)` : tuneShoulderAngle < 0 ? `${tuneShoulderAngle.toFixed(1)}° (L lower)` : '0.0° (Level)'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setTuneShoulderAngle(prev => Math.round((prev - 0.5) * 10) / 10)}
                          className="w-6 h-6 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold text-xs flex items-center justify-center hover:bg-stone-100"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="-10"
                          max="10"
                          step="0.5"
                          value={tuneShoulderAngle}
                          onChange={(e) => setTuneShoulderAngle(parseFloat(e.target.value))}
                          className="flex-1 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                        <button
                          type="button"
                          onClick={() => setTuneShoulderAngle(prev => Math.round((prev + 0.5) * 10) / 10)}
                          className="w-6 h-6 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold text-xs flex items-center justify-center hover:bg-stone-100"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex justify-between text-[10px] text-stone-400">
                        <span>-10° Left Slump</span>
                        <span className="text-emerald-700 font-medium">0° Level</span>
                        <span>+10° Right Slump</span>
                      </div>
                    </div>

                    {/* Axis 4: Shoulder Height Alignment Position */}
                    <div className="space-y-1.5 bg-stone-50 p-3 rounded-2xl border border-stone-200/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-700">Shoulder Height Position:</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-stone-900">
                            {shoulderOffsetVal > 0 ? `+${(shoulderOffsetVal * 100).toFixed(0)}% lower` : shoulderOffsetVal < 0 ? `${(shoulderOffsetVal * 100).toFixed(0)}% higher` : 'Standard'}
                          </span>
                          {shoulderOffsetVal !== 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setShoulderOffsetVal(0);
                                detectorRef.current?.setShoulderOffset(0);
                              }}
                              className="text-[10px] text-stone-500 hover:text-stone-800 underline"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.max(-0.20, Math.round((shoulderOffsetVal - 0.02) * 100) / 100);
                            setShoulderOffsetVal(next);
                            detectorRef.current?.setShoulderOffset(next);
                          }}
                          className="w-6 h-6 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold text-xs flex items-center justify-center hover:bg-stone-100"
                          title="Raise shoulder line"
                        >
                          ▲
                        </button>
                        <input
                          type="range"
                          min="-0.20"
                          max="0.20"
                          step="0.01"
                          value={shoulderOffsetVal}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setShoulderOffsetVal(val);
                            detectorRef.current?.setShoulderOffset(val);
                          }}
                          className="flex-1 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.min(0.20, Math.round((shoulderOffsetVal + 0.02) * 100) / 100);
                            setShoulderOffsetVal(next);
                            detectorRef.current?.setShoulderOffset(next);
                          }}
                          className="w-6 h-6 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold text-xs flex items-center justify-center hover:bg-stone-100"
                          title="Lower shoulder line"
                        >
                          ▼
                        </button>
                      </div>
                      <div className="flex justify-between text-[10px] text-stone-400">
                        <span>▲ Higher (Up)</span>
                        <span className="text-emerald-700 font-medium">Clavicle Line</span>
                        <span>▼ Lower (Down)</span>
                      </div>
                    </div>

                    {/* Sensitivity & Tolerance Selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-stone-700 block">Posture Tolerance Threshold:</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTuneTolerance('strict')}
                          className={`py-1.5 px-2 text-[10px] font-bold rounded-xl border transition ${
                            tuneTolerance === 'strict'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          Strict (±10°)
                        </button>
                        <button
                          type="button"
                          onClick={() => setTuneTolerance('standard')}
                          className={`py-1.5 px-2 text-[10px] font-bold rounded-xl border transition ${
                            tuneTolerance === 'standard'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          Standard (±14°)
                        </button>
                        <button
                          type="button"
                          onClick={() => setTuneTolerance('lenient')}
                          className={`py-1.5 px-2 text-[10px] font-bold rounded-xl border transition ${
                            tuneTolerance === 'lenient'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          Relaxed (±18°)
                        </button>
                      </div>
                    </div>

                    {/* Save Changes Button */}
                    <button
                      type="button"
                      onClick={() => {
                        finalizeCalibrationBaseline({
                          headAngle: tuneHeadAngle,
                          neckAngle: tuneNeckAngle,
                          shoulderAngle: tuneShoulderAngle,
                          toleranceLevel: tuneTolerance
                        });
                      }}
                      className="w-full py-2.5 px-3 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-2xl transition flex items-center justify-center space-x-1.5"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Save Tuned Reference Baseline</span>
                    </button>
                  </div>

                  {/* Why Calibration Matters */}
                  <div className="p-5 bg-stone-50 rounded-3xl border border-stone-200/70 space-y-3 text-xs text-stone-600">
                    <h5 className="font-bold text-stone-900 flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-700" />
                      <span>Why Initial Posture Setup is Critical</span>
                    </h5>
                    <p className="leading-relaxed">
                      Every workstation and spine geometry is unique. By capturing your upright position now, PostureCare establishes your personal <strong>neutral alignment threshold</strong>.
                    </p>
                    <p className="leading-relaxed">
                      During live monitoring, the AI compares your real-time posture against this baseline to calculate slump angles and alert you when spinal flexion exceeds healthy limits.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: HISTORY & TRENDS */}
        {activeTab === 'history' && (
          <div id="view-history" className="space-y-6">
            <div className="bg-white rounded-3xl border border-stone-200/90 p-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
                <div>
                  <h3 className="text-base font-bold text-stone-900">Historical Monitoring Sessions</h3>
                  <p className="text-xs text-stone-500">
                    Review ergonomics trends, session durations, and postural improvement over time.
                  </p>
                </div>
                <div className="flex items-center space-x-3 text-xs font-semibold text-stone-600">
                  <span>Total Sessions: <strong>{sessions.length}</strong></span>
                  <span>•</span>
                  <span>Cumulative Score: <strong>{sessions.length > 0 ? `${Math.round(sessions.reduce((acc, s) => acc + s.averageScore, 0) / sessions.length)}%` : '—'}</strong></span>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-2xl border border-stone-200/80">
                <table className="w-full text-left text-xs min-w-[620px]">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider font-bold">
                      <th className="py-3 px-4">Session Date</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4">Posture Score</th>
                      <th className="py-3 px-4">Good Ratio</th>
                      <th className="py-3 px-4">Alerts</th>
                      <th className="py-3 px-4">Key Deviation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {sessions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 px-4 text-center">
                          <div className="max-w-sm mx-auto space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-500 mx-auto">
                              <Activity className="w-5 h-5 text-emerald-700" />
                            </div>
                            <p className="text-xs font-bold text-stone-800">No Monitoring Sessions Logged Yet</p>
                            <p className="text-[11px] text-stone-500 leading-relaxed">
                              Complete your first live monitoring session to see your alignment scores, posture durations, and micro-slump events recorded here.
                            </p>
                            <button
                              onClick={requestStartMonitoring}
                              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-2xs transition inline-flex items-center space-x-1.5"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Start Live Monitoring</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      sessions.map((s) => (
                        <tr key={s.id} className="hover:bg-stone-50 transition">
                          <td className="py-3 px-4 font-medium text-stone-900">
                            {new Date(s.startTime).toLocaleDateString()} at {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 text-stone-600 font-mono">
                            {Math.floor(s.durationSeconds / 60)} mins
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              s.averageScore >= 85 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80' :
                              s.averageScore >= 70 ? 'bg-amber-50 text-amber-800 border border-amber-200/80' : 'bg-rose-50 text-rose-800 border border-rose-200/80'
                            }`}>
                              {s.averageScore}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-stone-600">
                            {Math.round((s.goodSeconds / s.durationSeconds) * 100)}%
                          </td>
                          <td className="py-3 px-4 text-stone-600 font-mono">
                            {s.alertCount} events
                          </td>
                          <td className="py-3 px-4 text-stone-500 italic max-w-xs truncate">
                            {s.primaryDeviation || 'Minor forward lean'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: GOALS */}
        {activeTab === 'goals' && (
          <div id="view-goals" className="space-y-6">
            <div className="bg-white rounded-3xl border border-stone-200/90 p-6 shadow-2xs">
              <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                <div>
                  <h3 className="text-base font-bold text-stone-900">Daily & Weekly Ergonomic Goals</h3>
                  <p className="text-xs text-stone-500">
                    Track your milestones to build sustainable spinal posture habits.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {goals.map((g) => (
                  <div key={g.id} className="p-5 rounded-2xl border border-stone-200/80 bg-stone-50/50 hover:bg-white transition shadow-2xs">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <Award className="w-4 h-4 text-emerald-700" />
                        <h4 className="text-xs font-bold text-stone-900">{g.title}</h4>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full ${
                        g.status === 'completed' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-stone-100 text-stone-700 border border-stone-200'
                      }`}>
                        {g.status}
                      </span>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between text-xs">
                      <span className="text-stone-500">Current Progress:</span>
                      <span className="font-bold text-stone-900">
                        {g.currentValue} / {g.targetValue} {g.unit}
                      </span>
                    </div>

                    <div className="w-full bg-stone-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (g.currentValue / g.targetValue) * 100)}%` }}
                      ></div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-stone-400">
                      <span>Category: <strong className="capitalize text-stone-600">{g.category}</strong></span>
                      <span>Target Date: {g.targetDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: DESK STRETCHES */}
        {activeTab === 'stretches' && (
          <div id="view-stretches" className="space-y-6">
            <div className="bg-white rounded-3xl border border-stone-200/90 p-6 shadow-2xs">
              <div className="pb-4 border-b border-stone-100">
                <h3 className="text-base font-bold text-stone-900">Guided Desk Stretches & Muscular Relief</h3>
                <p className="text-xs text-stone-500">
                  Targeted micro-stretches designed to relieve tension in the cervical spine, chest, and lower back.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Exercise List */}
                <div className="space-y-3">
                  {stretchesList.map((stretch) => {
                    const isSelected = selectedStretchId === stretch.id;
                    return (
                      <div
                        key={stretch.id}
                        onClick={() => setSelectedStretchId(stretch.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-300 shadow-2xs'
                            : 'bg-white border-stone-200/80 hover:border-stone-300'
                        }`}
                      >
                        <h4 className="text-xs font-bold text-stone-900">{stretch.title}</h4>
                        <p className="text-[11px] text-stone-500 mt-1">{stretch.target}</p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-stone-400">
                          <span>{stretch.duration}s hold</span>
                          <span className="text-emerald-800 font-semibold">{stretch.reps}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Detail View & Timer */}
                <div className="md:col-span-2 bg-stone-50 rounded-3xl border border-stone-200/90 p-6 flex flex-col justify-between">
                  {(() => {
                    const current = stretchesList.find(s => s.id === selectedStretchId) || stretchesList[0];
                    return (
                      <>
                        <div>
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full uppercase border border-emerald-200/60">
                                {current.target}
                              </span>
                              <h3 className="text-lg font-bold text-stone-900 mt-2">{current.title}</h3>
                            </div>
                            <span className="text-xs font-bold text-stone-500">{current.reps}</span>
                          </div>

                          <h5 className="text-xs font-bold text-stone-700 mb-2">Step-by-Step Instructions:</h5>
                          <ol className="space-y-2 text-xs text-stone-600 list-decimal list-inside leading-relaxed">
                            {current.instructions.map((step, i) => (
                              <li key={i} className="pl-1">{step}</li>
                            ))}
                          </ol>
                        </div>

                        <div className="mt-8 pt-4 border-t border-stone-200 flex items-center justify-between">
                          <div className="flex items-center space-x-2 text-xs text-stone-500">
                            <Clock className="w-4 h-4 text-emerald-700" />
                            <span>Recommended duration: <strong>{current.duration} seconds</strong></span>
                          </div>
                          <button
                            onClick={() => audioService.playSuccessChime()}
                            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-2xs transition"
                          >
                            Mark as Completed
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}


          </motion.div>
        </AnimatePresence>
      </main>

      {/* Persistent Disclaimer Footer */}
      <footer id="main-footer" className="bg-white border-t border-stone-200/80 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-2">
          <p>
            PostureCare Spine Health • Educational ergonomics tool, not medical advice.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/PostureCare_Review_1_Documentation.docx"
              download="PostureCare_Review_1_Documentation.docx"
              className="text-emerald-800 hover:text-emerald-900 font-bold flex items-center space-x-1 underline"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Review–I Word Doc (.docx)</span>
            </a>
            <span>•</span>
            <span>Sender: <strong className="text-stone-700">posturehealthcare@gmail.com</strong></span>
            <span>•</span>
            <span className="text-emerald-800 font-medium">No-Reply Monitored</span>
          </div>
        </div>
      </footer>

      {/* CAMERA PERMISSION MODAL */}
      {isCameraPromptModalOpen && (
        <div id="camera-prompt-modal" className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-stone-200 max-w-md w-full p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <Camera className="w-6 h-6 text-emerald-700" />
            </div>

            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-stone-900">Enable Camera for Posture Tracking</h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                PostureCare requires webcam access to estimate cervical spine alignment and posture in real time.
              </p>
            </div>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/70 mb-5 space-y-2 text-xs text-stone-600">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>100% on-device vision processing</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>No video frames or recordings are ever saved or sent anywhere</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>Immediate posture feedback & ergonomic chimes</span>
              </div>
            </div>

            {cameraError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            <div className="space-y-2">
              <button
                id="btn-confirm-enable-camera"
                onClick={handleEnableCamera}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center justify-center space-x-2"
              >
                <Camera className="w-4 h-4" />
                <span>Allow Camera & Start Validation</span>
              </button>

              <button
                onClick={handleEnableSimulation}
                className="w-full py-2 px-4 bg-stone-100 hover:bg-stone-200/70 text-stone-700 font-semibold text-xs rounded-xl transition"
              >
                Continue in Simulation Mode (No Camera)
              </button>

              <button
                onClick={() => setIsCameraPromptModalOpen(false)}
                className="w-full py-1.5 text-stone-400 hover:text-stone-600 text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        preferences={preferences}
        onPreferencesChange={setPreferences}
      />

      {/* INITIAL SETUP REQUIRED MODAL */}
      {isSetupRequiredModalOpen && (
        <div id="setup-required-modal" className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-stone-200 max-w-md w-full p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <Sparkles className="w-6 h-6 text-amber-600" />
            </div>

            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-stone-900">Initial Posture Setup Required</h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Before starting live monitoring, you must provide your neutral baseline positions for neck alignment and shoulder level. This ensures accurate slump detection.
              </p>
            </div>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/70 mb-5 space-y-2 text-xs text-stone-600">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span><strong>Neck Alignment:</strong> Aligns cervical angle with screen height</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span><strong>Shoulder Balance:</strong> Calibrates left & right shoulder symmetry</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span><strong>Fast 15-Second Setup:</strong> Guided posture calibration</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                id="btn-modal-calibrate-now"
                onClick={() => {
                  setIsSetupRequiredModalOpen(false);
                  setActiveTab('calibrate');
                  setCalibStep(1);
                }}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center justify-center space-x-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Calibrate Neck & Shoulders Now</span>
              </button>

              <button
                onClick={() => setIsSetupRequiredModalOpen(false)}
                className="w-full py-1.5 text-stone-400 hover:text-stone-600 text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CALIBRATION CAMERA WARNING MODAL */}
      {isCalibCameraWarningModalOpen && (
        <div id="calib-camera-warning-modal" className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-stone-200 max-w-md w-full p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <Camera className="w-6 h-6 text-amber-600" />
            </div>

            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-stone-900">Camera Required for Calibration</h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Your webcam is currently turned off. To capture accurate initial positions of your neck and shoulders, please enable your camera.
              </p>
            </div>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/70 mb-5 space-y-2 text-xs text-stone-600">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>Webcam feeds are processed 100% locally in your browser</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>Enables live geometric angle measurement of your posture</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                id="btn-modal-enable-calib-camera"
                onClick={async () => {
                  setIsCalibCameraWarningModalOpen(false);
                  await startCalibrationCamera();
                }}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center justify-center space-x-2"
              >
                <Camera className="w-4 h-4" />
                <span>Turn On Camera Now</span>
              </button>

              <button
                onClick={() => {
                  setIsCalibCameraWarningModalOpen(false);
                  finalizeCalibrationBaseline({
                    name: 'Ergonomic Standard Neutral',
                    headAngle: 8,
                    neckAngle: 22,
                    shoulderAngle: 12
                  });
                }}
                className="w-full py-2 px-4 bg-stone-100 hover:bg-stone-200/70 text-stone-700 font-semibold text-xs rounded-xl transition"
              >
                Use Standard Ergonomic Defaults
              </button>

              <button
                onClick={() => setIsCalibCameraWarningModalOpen(false)}
                className="w-full py-1.5 text-stone-400 hover:text-stone-600 text-xs font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

