export type Credentials = {
  username: string;
  password: string;
};

export type AuthUser = {
  username: string;
  email: string;
  displayName: string;
  role: "BIDDER" | "AUCTIONEER" | "ADMIN";
  profileId: string | null;
};

export type AuthSession = {
  accessToken: string;
  tokenType: "Bearer";
  user: AuthUser;
};

export type Bidder = {
  bidderId: string;
  name: string | null;
};

export type Auctioneer = {
  auctioneerId: string;
  name: string | null;
};

export type ItemCondition = "NEW" | "USED" | "HIGHLY_DAMAGED";
export type ListingDurationUnit = "HOURS" | "DAYS" | "WEEKS" | "MONTHS";

export type BidItem = {
  itemId: string;
  itemName: string | null;
  startingPrice: number | null;
  description: string | null;
  condition: ItemCondition | null;
  auctioneer?: Auctioneer | null;
  highestBidderId?: string | null;
  highestBidAmount?: number | null;
  bidCount?: number | null;
  expiresAt?: string | null;
};

export type ListItemPayload = {
  itemName: string;
  startingPrice: number;
  description: string;
  condition: ItemCondition;
  durationAmount: number;
  durationUnit: ListingDurationUnit;
};

export type ListedItemResponse = {
  itemId: string;
  itemName: string | null;
  auctioneerId: string | null;
  auctioneerName: string | null;
  expiresAt: string | null;
  message: string;
};

export type PlaceBidPayload = {
  amount: number;
  bidderId?: string;
};

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  displayName: string;
  role: "BIDDER" | "AUCTIONEER";
};

export type ItemSearchFilters = {
  query?: string;
  auctioneerId?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: ItemCondition;
};

export type ActiveBidSummary = {
  itemId: string;
  itemName: string | null;
  description: string | null;
  startingPrice: number | null;
  condition: ItemCondition | null;
  auctioneerId: string | null;
  auctioneerName: string | null;
  highestBidderId: string | null;
  highestBidAmount: number | null;
  viewerBidAmount: number | null;
  viewerIsHighestBidder: boolean;
  viewerOwnsListing: boolean;
};

export type BidHistorySummary = {
  itemId: string;
  itemName: string | null;
  description: string | null;
  startingPrice: number | null;
  condition: ItemCondition | null;
  auctioneerId: string | null;
  auctioneerName: string | null;
  highestBidderId: string | null;
  highestBidAmount: number | null;
  viewerBidAmount: number | null;
  lastBidAt: string | null;
  totalBidCount: number | null;
  viewerOwnsListing: boolean;
};

export type ApiResponse<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  raw: string;
};
