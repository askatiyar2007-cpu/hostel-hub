'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { HostelCard } from '@/components/hostel-card';
import { Button } from '@/components/ui/button';

interface HostelListing {
  id: string;
  name: string;
  description: string;
  city: string;
  address: string;
  cover_image_url?: string;
  rating: number;
  total_reviews: number;
  amenities: string[];
}

export default function MarketplacePage() {
  const [hostels, setHostels] = useState<HostelListing[]>([]);
  const [filteredHostels, setFilteredHostels] = useState<HostelListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    city: '',
    search: '',
  });

  const fetchHostels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('hostels')
        .select('*')
        .eq('status', 'approved')
        .limit(50);

      if (error) throw error;
      setHostels((data as HostelListing[]) || []);
    } catch (error) {
      console.error('Error fetching hostels:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHostels();
  }, [fetchHostels]);

  const filterHostels = useCallback(() => {
    let filtered = [...hostels];

    if (filters.city) {
      filtered = filtered.filter(h =>
        h.city.toLowerCase().includes(filters.city.toLowerCase())
      );
    }

    if (filters.search) {
      filtered = filtered.filter(h =>
        h.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        h.description.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    setFilteredHostels(filtered);
  }, [filters, hostels]);

  useEffect(() => {
    filterHostels();
  }, [filterHostels]);

  const cities = [...new Set(hostels.map(h => h.city))];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative overflow-hidden bg-muted/30 border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-60" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <h1 className="text-4xl font-display font-bold tracking-tight md:text-5xl">Find Your <span className="text-primary">Perfect</span> Home</h1>
          <p className="text-muted-foreground mt-4 text-lg max-w-2xl">Browse our curated selection of verified hostels across India, designed for comfort and safety.</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Filters */}
        <div className="bg-card rounded-2xl p-6 mb-12 border border-border shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold mb-2">Search</label>
              <input
                type="text"
                placeholder="Name, description..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">City</label>
              <select
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">All Cities</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setFilters({ city: '', search: '' })}
                className="w-full rounded-md"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-80 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filteredHostels.length === 0 ? (
          <div className="text-center py-24 bg-muted/20 rounded-3xl border border-dashed border-border">
            <p className="text-muted-foreground text-lg">No hostels found matching your criteria.</p>
            <Button variant="link" onClick={() => setFilters({ city: '', search: '' })}>
              View all hostels
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredHostels.map((hostel) => (
              <HostelCard key={hostel.id} hostel={hostel} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
