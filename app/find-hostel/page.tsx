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
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

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
      toast.error('Please enter a hostel name or hostel ID');
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
      toast.info('Please use your phone to scan QR codes');
      return;
    }

    setIsScanning(true);
    
    // Initialize scanner after state update
    setTimeout(() => {
      const readerElement = document.getElementById('qr-reader');
      if (!readerElement) return;

      // Dynamic import only when needed
      import('html5-qrcode').then((mod) => {
        if (!scannerRef.current) {
          scannerRef.current = new mod.Html5QrcodeScanner(
            'qr-reader',
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
          );
        }

        scannerRef.current.render(onScanSuccess, onScanFailure)
          .then(() => {
            console.log('Scanner started successfully');
          })
          .catch((err: any) => {
            console.error('Scanner error:', err);
            toast.error('Failed to start camera. Please ensure camera permission is granted.');
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
    console.log('QR scanned:', decodedText);
    stopScanner();

    // Validate QR content: match UUID anywhere or parse path
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

    // Verify hostel exists
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
    // Suppress console spam for normal scan failures
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-slate-600" />
          </Link>
          <h1 className="text-lg font-bold text-slate-900">Find a Hostel</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* Unified Search Option */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                <Search size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Search Hostels</h2>
                <p className="text-sm text-slate-500">Find hostels by name, location, or unique Hostel ID</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Search hostels by name or hostel ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button 
                onClick={handleSearch}
                disabled={loading}
                className="bg-teal-600 hover:bg-teal-700 text-white h-10 px-5 rounded-xl font-medium"
              >
                {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Search size={16} className="mr-2" />}
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live Search Results */}
        {loading && (
          <div className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <Loader2 size={28} className="animate-spin text-teal-600 mb-2" />
            <p className="text-sm text-slate-600">Searching hostels and checking live vacancy...</p>
          </div>
        )}

        {!loading && hasSearched && searchResults.length === 0 && (
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardContent className="p-8 text-center">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Search size={22} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">No hostels found</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                No properties matched &ldquo;{searchQuery}&rdquo;. Check the spelling or ask the owner for their exact Hostel ID or QR code.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && searchResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Matching Hostels ({searchResults.length})
              </h2>
              <span className="text-xs text-slate-500">Select a hostel to view details</span>
            </div>

            <div className="grid gap-4">
              {searchResults.map((h) => (
                <Card key={h.id} className="border border-slate-200 bg-white hover:border-teal-200 hover:shadow-md transition-all">
                  <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-slate-900">{h.name}</h3>
                        {h.totalBeds === 0 ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                            No rooms listed
                          </span>
                        ) : h.isFull ? (
                          <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                            Full (0 beds free)
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            {h.availableBeds} {h.availableBeds === 1 ? 'bed' : 'beds'} available
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin size={14} className="text-slate-400 shrink-0" />
                        <span>{h.city ? `${h.city} • ${h.address || ''}` : (h.address || 'Address not specified')}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 w-fit">
                        <Key size={12} className="text-slate-400 shrink-0" />
                        <span className="select-all">ID: {h.id}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center">
                      <Link href={`/hostels/${h.id}`} className="w-full md:w-auto">
                        <Button className="w-full md:w-auto h-9 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-xs">
                          View Hostel <ArrowRight size={14} className="ml-1.5" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* QR Scan Option */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <QrCode size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Scan Hostel QR</h2>
                <p className="text-sm text-slate-500">
                  {isMobile ? 'Scan the QR code from the hostel owner' : 'Use your phone to scan the hostel QR code'}
                </p>
              </div>
            </div>
            <Button
              onClick={startScanner}
              disabled={!isMobile}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white h-10 rounded-xl"
            >
              {isMobile ? (
                <>
                  <Camera size={16} className="mr-2" />
                  Scan Hostel QR
                </>
              ) : (
                <>
                  <QrCode size={16} className="mr-2" />
                  Scan with your phone
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border border-slate-200 bg-slate-50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-teal-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">About HostelHub</h3>
                <p className="text-sm text-slate-600">
                  HostelHub connects students with verified hostels. Ask your hostel owner for their unique QR code or Hostel ID to find their property quickly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QR Scanner Section */}
        {isScanning && (
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Scan Hostel QR</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={stopScanner}
                  className="h-8 w-8"
                >
                  <X size={18} />
                </Button>
              </div>
              <div id="qr-reader" className="w-full"></div>
              <p className="text-center text-sm text-slate-500 mt-4">
                Point your camera at the hostel QR code
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
