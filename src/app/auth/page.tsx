import AuthForm from './AuthForm'

export default function AuthPage({
  searchParams,
}: {
  searchParams: { intent?: string }
}) {
  const isSaveIntent = searchParams.intent === 'save'
  return <AuthForm isSaveIntent={isSaveIntent} />
}
