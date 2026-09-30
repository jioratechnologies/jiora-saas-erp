import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableRow } from "../components/ui/table";
import { PageHeader } from "../components/page-header";
import { QueryState } from "../components/query-state";
import { useConfirm } from "../hooks/use-confirm";
import { toast } from "../components/ui/toast";

interface NamedRecord {
  id: string;
  name: string;
}

/** Shared by Departments and Designations — both are just "a tenant-scoped list of names". */
export function SimpleNamedListPage({ title, apiPath }: { title: string; apiPath: string }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const queryKey = ["admin", apiPath];
  const singular = title.replace(/s$/, "");
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => api.get<NamedRecord[]>(apiPath) });

  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => api.post<NamedRecord>(apiPath, { name }),
    onSuccess: (record) => {
      const createdName = record?.name || name;
      setName("");
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${singular} created`, `"${createdName}" added successfully.`);
    },
    onError: (err) => {
      toast.error(`Failed to create ${singular.toLowerCase()}`, (err as Error).message);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${apiPath}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${singular} deleted`, "The record has been permanently removed.");
    },
    onError: (err) => {
      toast.error(`Failed to delete ${singular.toLowerCase()}`, (err as Error).message);
    },
  });

  return (
    <div>
      <PageHeader title={title} description={`Manage the ${title.toLowerCase()} used across your organisation.`} />

      <Card className="mb-4">
        <CardContent className="pt-3.5 sm:pt-5">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <Input
              placeholder={`New ${title.toLowerCase().replace(/s$/, "")} name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="max-w-xs"
            />
            <Button type="submit" disabled={create.isPending}>
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <QueryState isLoading={isLoading} error={error}>
            {data && data.length === 0 && (
              <p className="p-5 text-sm text-muted-foreground">No {title.toLowerCase()} yet — add one above.</p>
            )}
            {data && data.length > 0 && (
              <Table>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="w-10 text-right">
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Delete "${row.name}"?`,
                              description: "This can't be undone. Anyone currently assigned to it keeps their record, just without this value.",
                              confirmLabel: "Delete",
                            });
                            if (ok) remove.mutate(row.id);
                          }}
                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
