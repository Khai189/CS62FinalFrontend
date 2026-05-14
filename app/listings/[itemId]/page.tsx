import { ListingDetailView } from "@/components/listing-detail-view";

/**
 * Renders the detail page for a specific listing.
 * @param {Promise<{ itemID: string }>} - promise resolving to the route parameters containing the unique item ID 
 * @returns {Promise<JSX.Element>} rendered ListingDetailView component
 */
export default async function ListingDetailPage({
  params
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;

  return <ListingDetailView itemId={itemId} />;
}
