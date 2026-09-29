export type RepositorySortOrder = "newest" | "oldest" | "title";

export interface RepositorySearchCriteria {
    search: string;
    category: string;
    schoolYear: string;
    strand: string;
    sort: RepositorySortOrder;
    page: number;
}
