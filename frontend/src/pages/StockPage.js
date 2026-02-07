import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import Layout from '@/components/Layout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/utils/api';
import { toast } from 'sonner';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';

/**
 * Item-wise Stock Statement module.
 * Fetches stock summary and transactions by date range; each item row can expand
 * to show its inward and issue entries (filtered by item and date range).
 */
const StockPage = () => {
  const [user, setUser] = useState(null);
  const [stockData, setStockData] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [inwardEntries, setInwardEntries] = useState([]);
  const [issueEntries, setIssueEntries] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  /** Item code of the row currently expanded; null when none */
  const [expandedItemCode, setExpandedItemCode] = useState(null);

  useEffect(() => {
    fetchUser();
    api.get('/suppliers').then((r) => setSuppliers(r.data || [])).catch(() => {});
  }, []);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      toast.error('Failed to fetch user data');
    }
  };

  /**
   * Fetches stock statement and all transactions for the selected date range.
   * Stock summary: one row per item (Opening, Inward, Issue, Rate, Closing).
   * Inward/Issue lists are used to show item-wise details on expand.
   */
  const fetchStock = async () => {
    if (!fromDate || !toDate) {
      setStockData([]);
      setInwardEntries([]);
      setIssueEntries([]);
      setExpandedItemCode(null);
      return;
    }

    setLoading(true);
    setExpandedItemCode(null);
    try {
      const [stockResp, inwardResp, issueResp] = await Promise.all([
        api.get(`/stock?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`),
        api.get(`/inward?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`),
        api.get(`/issue?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`),
      ]);

      setStockData(stockResp.data || []);
      setInwardEntries(inwardResp.data || []);
      setIssueEntries(issueResp.data || []);
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        error.message ||
        'Failed to fetch stock statement or transactions';
      toast.error(typeof message === 'string' ? message : JSON.stringify(message));
      setStockData([]);
      setInwardEntries([]);
      setIssueEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchClick = () => {
    if (!fromDate || !toDate) {
      toast.error('Please select both From and To dates');
      return;
    }
    fetchStock();
  };

  const handleClear = () => {
    setFromDate('');
    setToDate('');
    setStockData([]);
    setInwardEntries([]);
    setIssueEntries([]);
    setExpandedItemCode(null);
  };

  /** Inward entries for a given item (already filtered by date range from API) */
  const getInwardForItem = (itemCode) =>
    inwardEntries.filter((e) => e.item_code === itemCode);

  /** Issue entries for a given item (already filtered by date range from API) */
  const getIssueForItem = (itemCode) =>
    issueEntries.filter((e) => e.item_code === itemCode);

  const toggleExpand = (itemCode) => {
    setExpandedItemCode((prev) => (prev === itemCode ? null : itemCode));
  };

  /** Format YYYY-MM-DD as DD/MM/YYYY for display and export */
  const toDDMMYYYY = (iso) => (iso ? format(parseISO(iso), 'dd/MM/yyyy') : '');

  /** Build flat rows for export (summary only, no transaction details). Includes Start Date & End Date from filters (DD/MM/YYYY). */
  const getExportRows = () =>
    stockData.map((s) => ({
      'Start Date': toDDMMYYYY(fromDate),
      'End Date': toDDMMYYYY(toDate),
      'Item Code': s.item_code,
      'Item Name': s.item_description || s.item_code,
      'Opening Stock': Number(s.opening_stk),
      'Inward Qty': Number(s.inward_qty),
      'Issue Qty': Number(s.issue_qty),
      Rate: s.rate != null ? Number(s.rate) : '',
      'Closing Stock': Number(s.closing_stk),
    }));

  const handleDownloadCSV = () => {
    if (!stockData.length) {
      toast.error('No data to export. Fetch a stock statement first.');
      return;
    }
    const csv = Papa.unparse(getExportRows());
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-statement_${fromDate}_to_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const handleDownloadExcel = () => {
    if (!stockData.length) {
      toast.error('No data to export. Fetch a stock statement first.');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(getExportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Statement');
    XLSX.writeFile(wb, `stock-statement_${fromDate}_to_${toDate}.xlsx`);
    toast.success('Excel file downloaded');
  };

  if (!user) return <div className="p-4">Loading...</div>;

  return (
    <Layout user={user}>
      <div className="space-y-6 p-4 md:p-6" data-testid="stock-page">
        <div>
          <h2 className="text-2xl font-bold">Item-wise Stock Statement</h2>
          <p className="text-gray-600">
            View stock summary and transaction details by item and date range.
          </p>
        </div>

        {/* Filters: From Date, To Date, Fetch, Clear */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full min-w-[160px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full min-w-[160px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleFetchClick}
                  disabled={!fromDate || !toDate || loading}
                  variant="default"
                >
                  {loading ? 'Loading...' : 'Fetch'}
                </Button>
                <Button onClick={handleClear} variant="outline">
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stock Statement: one row per item */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                Stock Statement (Item-wise Summary)
                {fromDate && toDate ? ` — ${toDDMMYYYY(fromDate)} to ${toDDMMYYYY(toDate)}` : ''}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadCSV}
                  disabled={!stockData.length}
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadExcel}
                  disabled={!stockData.length}
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  Excel
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Opening = Total Inward − Total Issue before From Date. Closing =
              Opening + Inward − Issue in range. Expand a row to see transactions.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Item Name / Item Code</TableHead>
                    <TableHead className="text-right">Opening Stock</TableHead>
                    <TableHead className="text-right">Inward Qty</TableHead>
                    <TableHead className="text-right">Issue Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Closing Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockData.map((stock) => {
                    const isExpanded = expandedItemCode === stock.item_code;
                    const itemInwards = getInwardForItem(stock.item_code);
                    const itemIssues = getIssueForItem(stock.item_code);

                    return (
                      <React.Fragment key={stock.item_code}>
                        <TableRow
                          data-testid={`stock-row-${stock.item_code}`}
                          className={
                            stock.closing_stk < 10
                              ? 'bg-red-50 hover:bg-red-100'
                              : 'hover:bg-muted/50'
                          }
                        >
                          <TableCell className="w-10 p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => toggleExpand(stock.item_code)}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">
                            {stock.item_description || stock.item_code}
                            <span className="text-gray-500 text-sm ml-1">
                              ({stock.item_code})
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(stock.opening_stk).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {Number(stock.inward_qty).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {Number(stock.issue_qty).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {stock.rate != null
                              ? Number(stock.rate).toFixed(2)
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {Number(stock.closing_stk).toFixed(2)}
                          </TableCell>
                        </TableRow>

                        {/* Expandable: item-wise transaction details */}
                        {isExpanded && (
                          <TableRow
                            data-testid={`stock-detail-${stock.item_code}`}
                            className="bg-muted/30"
                          >
                            <TableCell
                              colSpan={7}
                              className="p-4 align-top"
                            >
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pl-6">
                                <div>
                                  <h4 className="font-semibold mb-2">
                                    Inward Entries (this item, date range)
                                  </h4>
                                  {itemInwards.length > 0 ? (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Date</TableHead>
                                          <TableHead className="text-right">
                                            Quantity
                                          </TableHead>
                                          <TableHead>
                                            Supplier / Reference
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {itemInwards.map((it) => (
                                          <TableRow key={it.entry_id}>
                                            <TableCell>
                                              {format(new Date(it.date), 'dd/MM/yyyy')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              {Number(it.inward_qty).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                              {suppliers.find(s => s.id === it.supplier)?.supplier_name || it.supplier || it.ref_no || '—'}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  ) : (
                                    <p className="text-sm text-gray-500 py-4">
                                      No inward entries in this period.
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-semibold mb-2">
                                    Issue Entries (this item, date range)
                                  </h4>
                                  {itemIssues.length > 0 ? (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Date</TableHead>
                                          <TableHead className="text-right">
                                            Quantity
                                          </TableHead>
                                          <TableHead>Created By</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {itemIssues.map((it) => (
                                          <TableRow key={it.entry_id}>
                                            <TableCell>
                                              {format(new Date(it.date), 'dd/MM/yyyy')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              {Number(it.issued_qty).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                              {it.created_by_name ?? it.created_by ?? '—'}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  ) : (
                                    <p className="text-sm text-gray-500 py-4">
                                      No issue entries in this period.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {stockData.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-10 text-gray-500"
                      >
                        No stock data available for the selected range. Select
                        From and To dates and click Fetch.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default StockPage;
