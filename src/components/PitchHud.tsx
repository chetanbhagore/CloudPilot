import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, ChevronUp, Mic, X } from 'lucide-react';
import { sound } from '../utils/soundEngine';

interface PitchHudProps {
  currentPath: string;
}

const PITCH_SCRIPTS: Record<string, { title: string; subtitle: string; bullets: string[]; quote: string }> = {
  '/': {
    title: 'Executive Vision & Dashboard',
    subtitle: 'The Apple Keynote Problem & Solution',
    bullets: [
      'Cloud bills are cryptic and terrifying for students and early startups.',
      'Existing tools either dump raw charts (AWS Cost Explorer) or demand write access.',
      'CloudPilot is "AI that explains, human that approves" — read-only telemetry with zero credential risk.',
      'Notice the immediate transparency: Real security score jump from 34 to 72% once resolved.'
    ],
    quote: '"We don\'t automate blindly. We give small engineering teams clear evidence and verified outcomes."'
  },
  '/connect': {
    title: 'Zero-Credential Safe Onboarding',
    subtitle: 'Eliminating the #1 fear of cloud tooling',
    bullets: [
      'No secret API access keys stored anywhere.',
      'Uses standard AWS IAM Cross-Account Role with AWS SecurityAudit read-only policy.',
      'One-click sample sandbox accounts allow instant live demonstration with zero AWS billing setup.',
      'ExternalId condition protects against Confused Deputy attacks.'
    ],
    quote: '"You would never give a stranger your master keys. Why do cloud tools ask for admin credentials?"'
  },
  '/discover': {
    title: 'Evidence-Driven Discovery',
    subtitle: 'Deterministic Rules + Deep Telemetry',
    bullets: [
      'AI explains findings in plain human language, but deterministic evidence proves the issue.',
      'Scanned 47 resources in 4.3 seconds with live CloudWatch telemetry correlation.',
      'Separates findings into Security Vulnerabilities and Pure Cost Leaks.',
      'Financial impacts are strictly labeled as "Estimates based on current run-rate" — never misleading claims.'
    ],
    quote: '"Every finding shows raw telemetry evidence: zero CPU utilization, unattached days, or public CIDR ingress."'
  },
  '/passport': {
    title: 'The Core Innovation: Safety Passport™',
    subtitle: 'Pre-flight check before touching any cloud asset',
    bullets: [
      'Modeled after aerospace pre-flight safety checklists and boarding passports.',
      '5 deterministic safety checks verified before any action is permitted.',
      'Explicit blast-radius and side-effects disclosure: active TCP sessions persist, new ingress blocked.',
      'Guaranteed rollback CLI script provided upfront so the developer is always in full control.'
    ],
    quote: '"This is the Safety Passport: a cryptographically verifiable contract between AI and human operator."'
  },
  '/approve': {
    title: 'Human Agency: Friction That Protects',
    subtitle: 'The Slide-to-Approve & Live Simulation',
    bullets: [
      'No accidental clicks: Apple-style physical slider with velocity and spring resistance.',
      'Simulated live remediation pipeline with step-by-step terminal execution.',
      'Real-time before/after diff of security group ingress rules.',
      'Zero hallucinations: only whitelisted, atomic AWS operations can be executed.'
    ],
    quote: '"Friction is a feature when managing production infrastructure. The human engineer always signs off."'
  },
  '/audit': {
    title: 'Immutable Proof & Verification',
    subtitle: 'Proving the outcome with auditable receipts',
    bullets: [
      'Full cryptographic audit receipt with SHA-256 simulation fingerprint.',
      'Before-and-after state capture: proves rule was actually removed.',
      'Exportable verification certificate for compliance, SOC2, or investor due-diligence.',
      'Zero unauthorized executions guaranteed by design.'
    ],
    quote: '"Understand your cloud. Approve the fix. Prove the outcome."'
  }
};

export default function PitchHud({ currentPath }: PitchHudProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  const script = PITCH_SCRIPTS[currentPath] || PITCH_SCRIPTS['/'];

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          sound.playClick();
          setIsOpen(true);
          setIsMinimized(false);
        }}
        className="btn btn-dark"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 28,
          zIndex: 90,
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 9999
        }}
      >
        <Mic size={15} color="#FF9F0A" /> Presenter Pitch Script
      </button>
    );
  }

  return (
    <motion.div
      className="pitch-hud"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <div className="pitch-hud-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Sparkles size={15} color="#FF9F0A" />
          <span style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Pitch Demo Script</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => {
              sound.playClick();
              setIsMinimized(!isMinimized);
            }}
            className="btn btn-ghost"
            style={{ padding: 4, height: 24, width: 24, borderRadius: 6, color: '#A1A1A6' }}
            title={isMinimized ? 'Expand notes' : 'Minimize notes'}
          >
            {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setIsOpen(false);
            }}
            className="btn btn-ghost"
            style={{ padding: 4, height: 24, width: 24, borderRadius: 6, color: '#A1A1A6' }}
            title="Close Pitch HUD"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', marginBottom: 2 }}>
        {script.title}
      </div>
      <div style={{ fontSize: 11.5, color: '#A1A1A6', marginBottom: isMinimized ? 0 : 10 }}>
        {script.subtitle}
      </div>

      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {script.bullets.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.45, color: '#D1D5DB' }}>
                  <span style={{ color: '#0071E3', fontWeight: 800 }}>•</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                padding: '8px 10px',
                background: 'rgba(255, 255, 255, 0.06)',
                borderRadius: 8,
                fontSize: 11.5,
                fontStyle: 'italic',
                color: '#9CA3AF',
                borderLeft: '2px solid #FF9F0A'
              }}
            >
              {script.quote}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
