'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { MapPin, Star } from 'lucide-react';
import Link from 'next/link';

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

  useEffect(() => {
    fetchHostels();
  }, []);

  useEffect(() => {
    filterHostels();
  }, [filters, hostels]);

  const fetchHostels = async () => {
    try {
      const { data, error } = await supabase
        .from('hostels')
        .select('*')
        .limit(50);

      if (error) throw error;
      setHostels((data as HostelListing[]) || []);
    } catch (error) {
      console.error('Error fetching hostels:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterHostels = () => {
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
  };

  const cities = [...new Set(hostels.map(h => h.city))];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-background to-secondary/10 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <h1 className="text-4xl font-display font-bold">Find Your Hostel</h1>
          <p className="text-muted-foreground mt-2">Browse and book your perfect hostel</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="bg-card rounded-lg p-6 mb-8 border border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Search</label>
              <input
                type="text"
                placeholder="Search hostels..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">City</label>
              <select
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                className="input w-full"
              >
                <option value="">All Cities</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ city: '', search: '' })}
                className="btn-secondary w-full"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading hostels...</p>
          </div>
        ) : filteredHostels.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No hostels found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHostels.map((hostel) => (
              <Link
                key={hostel.id}
                href={`/hostel/${hostel.id}`}
                className="group"
              >
                <div className="card overflow-hidden hover:shadow-lg transition-all">
                  {/* Image */}
                  {hostel.cover_image_url ? (
                    <img
                      src={hostel.cover_image_url}
                      alt={hostel.name}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground">No Image</span>
                    </div>
                  )}

                  <div className="p-4 space-y-3">
                    {/* Name & Location */}
                    <div>
                      <h3 className="text-lg font-bold line-clamp-1 group-hover:text-primary transition-colors">
                        {hostel.name}
                      </h3>
                      <div className="flex items-center text-muted-foreground text-sm mt-1">
                        <MapPin size={16} />
                        <span className="ml-1">{hostel.city}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {hostel.description}
                    </p>

                    {/* Rating */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Star size={16} className="fill-amber-400 text-amber-400" />
                        <span className="ml-1 font-semibold">{hostel.rating.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground ml-1">
                          ({hostel.total_reviews})
                        </span>
                      </div>
                    </div>

                    {/* Amenities */}
                    {hostel.amenities && hostel.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {hostel.amenities.slice(0, 3).map((amenity, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                          >
                            {amenity}
                          </span>
                        ))}
                        {hostel.amenities.length > 3 && (
                          <span className="inline-flex items-center text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            +{hostel.amenities.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* CTA */}
                    <button className="btn-primary w-full mt-4">
                      View Details
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
