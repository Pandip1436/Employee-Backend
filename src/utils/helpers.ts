import { PaginationQuery } from "../types";

export const parsePagination = (query: PaginationQuery) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const skip = (page - 1) * limit;
  const sort = query.sort || "-createdAt";
  return { page, limit, skip, sort };
};
