import './ProgressBar.css'

const STEPS = [
  { key: 1, label: 'Modules' },
  { key: 2, label: 'Intent' },
  { key: 3, label: 'Generate' },
]

export default function ProgressBar({ currentStep }) {
  return (
    <div className="progress-bar">
      {STEPS.map((step, i) => (
        <div key={step.key} className="progress-step-wrap">
          <div
            className={`progress-step ${
              currentStep === step.key
                ? 'current'
                : currentStep > step.key
                ? 'done'
                : ''
            }`}
          >
            <span className="progress-step-num">{step.key}</span>
            <span className="progress-step-label">{step.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`progress-line ${currentStep > step.key ? 'done' : ''}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
