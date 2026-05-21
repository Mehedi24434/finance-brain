"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MemoryTabs({
  notes,
  people,
  concerns,
}: {
  notes: React.ReactNode;
  people: React.ReactNode;
  concerns: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="notes" className="space-y-3">
      <TabsList>
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="people">People</TabsTrigger>
        <TabsTrigger value="concerns">Concerns</TabsTrigger>
      </TabsList>
      <TabsContent value="notes" className="bg-surface border border-border rounded-lg">
        {notes}
      </TabsContent>
      <TabsContent value="people" className="bg-surface border border-border rounded-lg">
        {people}
      </TabsContent>
      <TabsContent value="concerns" className="bg-surface border border-border rounded-lg">
        {concerns}
      </TabsContent>
    </Tabs>
  );
}
