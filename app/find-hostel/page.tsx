'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { 
  Search, 
  QrCode, 
  Key, 
  ArrowRight, 
  ArrowLeft,
  X, 
  Camera,
  Building2,
  Loader2,
  MapPin,
  Bed,
  ScanLine
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { calculateHostelOccupancy } from '@/lib/utils/occupancy';

export default function FindHostelPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<any>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  const handleSearch = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      toast.error('Please enter a hostel name, city, or hostel ID');
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

      let fetchedHostels: any[] = [];

      if (isUuid) {
        const { data, error } = await supabase
          .from('hostels')
          .select(`
            id,
            name,
            city,
            address,
            rooms (
              id,
              capacity,
              occupancy,
              occupied_count,
              occupied_beds
            )
          `)
          .eq('id', trimmed.toLowerCase());

        if (error) throw error;
        fetchedHostels = data || [];
      }

      if (fetchedHostels.length === 0) {
        const { data, error } = await supabase
          .from('hostels')
          .select(`
            id,
            name,
            city,
            address,
            rooms (
              id,
              capacity,
              occupancy,
              occupied_count,
              occupied_beds
            )
          `)
          .or(`name.ilike.%${trimmed}%,city.ilike.%${trimmed}%`)
          .limit(20);

        if (error) throw error;
        fetchedHostels = data || [];
      }

      const resultsWithOccupancy = fetchedHostels.map((h: any) => {
        const occ = calculateHostelOccupancy(h.rooms || []);
        return {
          ...h,
          totalBeds: occ.totalBeds,
          occupiedBeds: occ.occupiedBeds,
          availableBeds: occ.availableBeds,
          isFull: occ.totalBeds > 0 ? occ.availableBeds <= 0 : false,
        };
      });

      setSearchResults(resultsWithOccupancy);

      if (resultsWithOccupancy.length === 0) {
        toast.error('No hostels found matching your search');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search hostels');
    } finally {
      setLoading(false);
    }
  };

  const startScanner = async () => {
    if (!isMobile) {
      toast.info('Please open HostelHub on your mobile phone to scan QR codes with your camera.');
      return;
    }

    setIsScanning(true);
    
    // Initialize scanner after state update
    setTimeout(() => {
      const readerElement = document.getElementById('qr-reader');
      if (!readerElement) return;

      import('html5-qrcode').then((mod) => {
        if (!scannerRef.current) {
          scannerRef.current = new mod.Html5QrcodeScanner(
            'qr-reader',
            { fps: 10, qrbox: { width: 240, height: 240 } },
            /* verbose= */ false
          );
        }

        scannerRef.current.render(onScanSuccess, onScanFailure)
          .catch((err: any) => {
            console.error('Scanner error:', err);
            toast.error('Failed to access camera. Please grant camera permission.');
            setIsScanning(false);
          });
      }).catch(() => {
        toast.error('Failed to load QR scanner');
        setIsScanning(false);
      });
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
    }
    setIsScanning(false);
  };

  const onScanSuccess = async (decodedText: string) => {
    stopScanner();

    let hostelId: string | null = null;
    const uuidMatch = decodedText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      hostelId = uuidMatch[0].toLowerCase();
    } else {
      try {
        const url = new URL(decodedText);
        const pathParts = url.pathname.split('/');
        const hostelsIndex = pathParts.indexOf('hostels');
        if (hostelsIndex !== -1 && pathParts[hostelsIndex + 1]) {
          hostelId = pathParts[hostelsIndex + 1].trim();
        }
      } catch {
        // Not a URL
      }
    }

    if (!hostelId) {
      toast.error('Invalid HostelHub QR code');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hostels')
        .select('*')
        .eq('id', hostelId)
        .maybeSingle();

      if (error || !data) {
        toast.error('Hostel not found');
      } else {
        router.push(`/hostels/${hostelId}`);
      }
    } catch {
      toast.error('Failed to validate hostel');
    } finally {
      setLoading(false);
    }
  };

  const onScanFailure = () => {
    // Suppress console spam for normal scan frames
  };

  return (
    <div className="min-h-screen bg-[#FAFCFB] dark:bg-[#07131d] text-slate-900 dark:text-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* Navigation Breadcrumb */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400 transition-colors mb-5 group"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Home</span>
        </Link>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Find a Hostel
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Search verified properties by name, city, or unique Hostel ID
          </p>
        </div>

        {/* Cohesive Search Bar */}
        <div className="relative mb-6">
          <div className="flex items-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e222e] shadow-xs focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 dark:focus-within:border-teal-500 transition-all p-1.5 gap-2">
            <div className="pl-3.5 text-slate-400 dark:text-slate-500 shrink-0">
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Hostel name, city, or Hostel ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 h-10 px-2 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none dark:!bg-transparent dark:!border-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="h-10 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium shrink-0 transition-colors shadow-none"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                'Search'
              )}
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 size={26} className="animate-spin text-teal-600 mb-2.5" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Searching properties and checking live availability…</p>
          </div>
        )}

        {/* No Results State */}
        {!loading && hasSearched && searchResults.length === 0 && (
          <div className="text-center py-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e222e] p-8 mb-6">
            <div className="h-11 w-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
              <Search size={20} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">No hostels found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              No properties matched &ldquo;{searchQuery}&rdquo;. Check the spelling or ask the hostel owner for their exact Hostel ID or QR code.
            </p>
          </div>
        )}

        {/* Search Results List */}
        {!loading && searchResults.length > 0 && (
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Matching Properties ({searchResults.length})
              </h2>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Select to view room vacancy
              </span>
            </div>

            <div className="grid gap-3">
              {searchResults.map((h) => (
                <Link
                  key={h.id}
                  href={`/hostels/${h.id}`}
                  className="group block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e222e] p-4 sm:p-5 hover:border-teal-300 dark:hover:border-teal-700/80 hover:shadow-xs transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors truncate">
                          {h.name}
                        </h3>
                        {h.totalBeds === 0 ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            No rooms listed
                          </span>
                        ) : h.isFull ? (
                          <span className="inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                            Full (0 beds free)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                            <Bed size={11} />
                            {h.availableBeds} {h.availableBeds === 1 ? 'bed' : 'beds'} available
                          </span>
                        )}
                      </div>

                      {(h.city || h.address) && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <MapPin size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                          <span className="truncate">
                            {h.city ? `${h.city}${h.address ? ` · ${h.address}` : ''}` : (h.address || '')}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        <Key size={11} className="shrink-0 text-slate-400 dark:text-slate-500" />
                        <span className="select-all truncate">ID: {h.id}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center justify-end sm:pl-3">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 group-hover:translate-x-0.5 transition-transform">
                        View Hostel
                        <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* QR Scan Section — Teal Design System */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e222e] overflow-hidden mb-6">
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-100 dark:border-teal-900/60 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                <QrCode size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Scan Hostel QR Code
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isMobile
                    ? "Point your camera at the owner's hostel QR to open details instantly"
                    : "Use your smartphone camera to scan the hostel's unique QR code"}
                </p>
              </div>
            </div>
            <Button
              onClick={startScanner}
              variant="outline"
              className="h-9 px-4 text-xs font-medium rounded-xl border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 shrink-0 self-start sm:self-auto"
            >
              {isMobile ? (
                <>
                  <Camera size={14} className="mr-1.5" />
                  Open Scanner
                </>
              ) : (
                <>
                  <ScanLine size={14} className="mr-1.5" />
                  Scan with Phone
                </>
              )}
            </Button>
          </div>

          {/* Inline Scanner */}
          {isScanning && (
            <div className="border-t border-slate-200 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Align QR code within the camera frame
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={stopScanner}
                  className="h-7 w-7 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  aria-label="Close scanner"
                >
                  <X size={16} />
                </Button>
              </div>
              <div id="qr-reader" className="w-full rounded-xl overflow-hidden bg-black/5 dark:bg-black/20"></div>
            </div>
          )}
        </div>

        {/* Reassuring Footer Tip */}
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center flex items-center justify-center gap-1.5">
          <Building2 size={13} className="shrink-0" />
          <span>Every verified property has a unique Hostel ID and QR code provided by the owner.</span>
        </p>
      </div>
    </div>
  );
}
