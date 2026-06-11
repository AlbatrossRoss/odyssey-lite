import { AccountsView } from "@/components/AccountsView";

type AccountProfilePageProps = {
  params: Promise<{
    username: string;
  }>;
};

export default async function AccountProfilePage({ params }: AccountProfilePageProps) {
  const { username } = await params;

  return <AccountsView username={username} />;
}
