export default function Shell({ children, className = "bg-background" }) {
  return <div className={`phone-shell relative flex min-h-dvh flex-col overflow-x-hidden ${className}`}>{children}</div>;
}
