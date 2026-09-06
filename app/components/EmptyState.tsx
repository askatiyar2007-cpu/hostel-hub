import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Plus, Building2, Bed } from 'lucide-react';

interface EmptyStateProps {
  /** Whether any filter/search is currently applied. */
  hasFilters: boolean;
  /** Callback to clear active filters. */
  onClearFilters: () => void;
  /** Optional selected hostel identifier, used to customise the CTA link. */
  selectedHostel?: string;
  /** Type of list for which this empty state is rendered. Determines icon and CTA. */
  type?: 'hostels' | 'rooms' | 'students' | 'requests';
}

/** Reusable empty‑state component used across Owner list pages. */
export default function EmptyState({
  hasFilters,
  onClearFilters,
  selectedHostel,
  type = 'hostels',
}: EmptyStateProps) {
  const Icon = type === 'rooms' ? Bed : Building2;
  const ctaHref = (() => {
    switch (type) {
      case 'rooms':
        return selectedHostel ? `/owner/rooms/new?hostelId=${selectedHostel}` : '/owner/rooms/new';
      case 'students':
        return '/owner/students/new';
      case 'requests':
        return '/owner/requests';
      default:
        return '/owner/hostels/new';
    }
  })();
  const ctaLabel = (() => {
    switch (type) {
      case 'rooms':
        return 'Add Room';
      case 'students':
        return 'Add Student';
      case 'requests':
        return 'Create Request';
      default:
        return 'Add Hostel';
    }
  })();

  if (hasFilters) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-12 text-center">
          <Icon className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            No results match your filters
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Try adjusting your search or clearing the filters.
          </p>
          <Button variant="outline" onClick={onClearFilters}>
            Clear Filters
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-12 text-center">
        <Icon className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">
          {type === 'rooms' ? 'No rooms yet' : type === 'students' ? 'No students yet' : type === 'requests' ? 'No requests yet' : 'No hostels yet'}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {type === 'rooms'
            ? 'Add your first room to start managing allocations.'
            : type === 'students'
            ? 'Add a student to manage their accommodation.'
            : type === 'requests'
            ? 'Create a room request to begin the workflow.'
            : 'Add your first hostel to start managing properties, rooms, and residents.'}
        </p>
        <Link href={ctaHref}>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus size={20} className="mr-2" />
            {ctaLabel}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
