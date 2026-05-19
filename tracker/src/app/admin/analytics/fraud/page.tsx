import { redirect } from 'next/navigation';

export default function FraudRedirect() {
  redirect('/admin/analytics');
}
