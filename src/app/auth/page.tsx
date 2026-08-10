import AuthForm from './AuthForm'

export default function AuthPage({
  searchParams,
}: {
  searchParams: { intent?: string; next?: string }
}) {
  const isSaveIntent = searchParams.intent === 'save'
  const nextPath = searchParams.next?.startsWith('/') && !searchParams.next.startsWith('//')
    ? searchParams.next
    : '/dashboard'
  return <AuthForm isSaveIntent={isSaveIntent} nextPath={nextPath} />
}
