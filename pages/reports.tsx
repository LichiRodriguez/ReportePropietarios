import type { GetServerSideProps } from 'next';
import { getTenantFromPageContext } from '@/lib/auth';
import ReportsPanel from '../components/ReportsPanel';

export default function ReportsPage() {
  return (
    <div>
      <ReportsPanel />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const tenant = await getTenantFromPageContext(req);
  if (!tenant) {
    return { redirect: { destination: '/auth-required', permanent: false } };
  }
  return { props: {} };
};
