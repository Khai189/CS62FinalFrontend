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

export type BidItem = {
  itemId: string;
  itemName: string | null;
  startingPrice: number | null;
  description: string | null;
  auctioneer?: Auctioneer | null;
};

export type ListItemPayload = {
  itemId: string;
  itemName: string;
  startingPrice: number;
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

export type ApiResponse<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  raw: string;
};
