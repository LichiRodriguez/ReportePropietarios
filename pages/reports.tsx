import type { GetServerSideProps } from 'next';
import { getTenantFromPageContext } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import ReportsPanel from '../components/ReportsPanel';

export default function ReportsPage({ propertiesCount }: { propertiesCount: number }) {
  return (
    <div>
      <ReportsPanel propertiesCount={propertiesCount} />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const tenant = await getTenantFromPageContext(req);
  if (!tenant) {
    return { redirect: { destination: '/auth-required', permanent: false } };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { count } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id);

  return { props: { propertiesCount: count || 0 } };
};
