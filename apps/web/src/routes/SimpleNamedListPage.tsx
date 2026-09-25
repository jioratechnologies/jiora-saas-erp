import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button, Card, Input, PageHeading, QueryState } from "../components/ui";

interface NamedRecord {
  id: string;
  name: string;
}

/** Shared by Departments and Designations — both are just "a tenant-scoped list of names". */
export function SimpleNamedListPage({ title, apiPath }: { title: string; apiPath: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["admin", apiPath];
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => api.get<NamedRecord[]>(apiPath) });

  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => api.post<NamedRecord>(apiPath, { name }),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${apiPath}/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return (
    <div className="space-y-6">
      <PageHeading>{title}</PageHeading>
      <Card className="max-w-md">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Input placeholder={`New ${title.toLowerCase()} name`} value={name} onChange={(e) => setName(e.target.value)} required />
          <Button type="submit" disabled={create.isPending}>
            Add
          </Button>
        </form>
      </Card>
      <Card>
        <QueryState isLoading={isLoading} error={error}>
          <ul className="divide-y divide-border text-sm">
            {data?.map((row) => (
              <li key={row.id} className="flex items-center justify-between py-2">
                {row.name}
                <button
                  onClick={() => remove.mutate(row.id)}
                  className="text-xs text-muted-foreground hover:text-red-600"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </QueryState>
      </Card>
    </div>
  );
}
