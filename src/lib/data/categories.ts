import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { Category, CategoryKind } from "@/types/domain";

type Client = SupabaseClient<Database>;

/** Active categories of a given kind, alphabetically. */
export async function listCategories(
  supabase: Client,
  kind?: CategoryKind,
): Promise<Category[]> {
  let query = supabase
    .from("categories")
    .select("*")
    .eq("is_archived", false)
    .order("name", { ascending: true });

  if (kind) query = query.eq("kind", kind);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return data ?? [];
}

/** All active categories, grouped by kind, for populating transaction forms. */
export async function getCategoriesByKind(
  supabase: Client,
): Promise<{ income: Category[]; expense: Category[] }> {
  const categories = await listCategories(supabase);
  return {
    income: categories.filter((c) => c.kind === "income"),
    expense: categories.filter((c) => c.kind === "expense"),
  };
}
