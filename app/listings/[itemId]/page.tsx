import { ListingDetailView } from "@/components/listing-detail-view";

export default async function ListingDetailPage({
  params
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;

  return <ListingDetailView itemId={itemId} />;
}
