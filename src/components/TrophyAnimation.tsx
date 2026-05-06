import { useEffect, useState } from 'react'

interface TrophyAnimationProps {
  onDone: () => void
}

const CONFETTI_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']

export function TrophyAnimation({ onDone }: TrophyAnimationProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 350)
    const t2 = setTimeout(() => setPhase('out'), 2400)
    const t3 = setTimeout(() => onDone(), 2900)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [onDone])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
        opacity: phase === 'out' ? 0 : 1,
        transition: 'opacity 0.5s ease',
        pointerEvents: 'none',
      }}
    >
      {/* Trophy card */}
      <div
        style={{
          textAlign: 'center',
          background: 'linear-gradient(135deg, hsl(45 90% 15%), hsl(45 80% 25%))',
          border: '2px solid hsl(45 80% 55%)',
          borderRadius: 20,
          padding: '32px 48px',
          boxShadow: '0 0 60px hsl(45 90% 50% / 0.5)',
          transform: phase === 'in' ? 'scale(0.3) translateY(40px)' : 'scale(1) translateY(0)',
          opacity: phase === 'in' ? 0 : 1,
          transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
        }}
      >
        <div style={{ fontSize: 80, lineHeight: 1, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}>🏆</div>
        <p style={{ marginTop: 14, fontSize: 20, fontWeight: 800, color: 'hsl(45 90% 75%)', letterSpacing: '-0.02em' }}>
          Achievement Unlocked!
        </p>
        <p style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.7)', maxWidth: 220 }}>
          You used your spare time productively today
        </p>
      </div>

      {/* Confetti */}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            top: -12,
            left: `${3 + i * 4}%`,
            width: i % 3 === 0 ? 12 : 8,
            height: i % 3 === 0 ? 12 : 8,
            borderRadius: i % 2 === 0 ? '50%' : 3,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animation: `confetti-fall ${1.4 + (i % 5) * 0.25}s ${(i % 6) * 0.1}s ease-in forwards`,
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  )
}
