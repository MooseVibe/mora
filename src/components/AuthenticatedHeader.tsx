type Props = {
  firstName: string
  avatarUrl?: string
}

export default function AuthenticatedHeader({ firstName, avatarUrl }: Props) {
  return (
    <header className="auth-header">
      <a href="/" className="auth-header-logo">
        <span className="auth-header-logo-icon">✦</span>
        <span className="auth-header-logo-text">MORA</span>
      </a>
      <div className="auth-header-right">
        <div className="auth-header-avatar-wrap">
          {avatarUrl
            ? <img src={avatarUrl} alt={firstName} className="auth-header-avatar" />
            : <div className="auth-header-avatar-placeholder">{firstName[0]}</div>
          }
        </div>
        <a href="/auth/logout" className="auth-header-logout">Выйти</a>
      </div>
    </header>
  )
}
