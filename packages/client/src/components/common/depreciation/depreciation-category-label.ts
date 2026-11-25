/** A depreciation category's name and rate; a 0% category is labelled "not depreciated" */
export function depreciationCategoryLabel(category: { name: string; percentage: number }): string {
  return category.percentage === 0
    ? `${category.name} (not depreciated)`
    : `${category.name} (${category.percentage}%)`;
}
