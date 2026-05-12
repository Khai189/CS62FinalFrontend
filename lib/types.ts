export type Credentials = {
  username: string;
  password: string;
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
  auctioneerId: string;
  auctioneerName: string;
};

export type PlaceBidPayload = {
  bidderId: string;
  amount: number;
};

export type ApiResponse<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  raw: string;
};
