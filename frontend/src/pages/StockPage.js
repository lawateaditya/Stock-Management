import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/utils/api';
import { toast } from 'sonner';

const StockPage = () => {
  const [user, setUser] = useState(null);
  const [stockData, setStockData] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [inwardEntries, setInwardEntries] = useState([]);
  const [issueEntries, setIssueEntries] = useState([]);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      toast.error('Failed to fetch user data');
    }
  };

  const fetchStock = async () => {
    if (!fromDate || !toDate) {
      setStockData([]);
      setInwardEntries([]);
      setIssueEntries([]);
      return;
    }

    setLoading(true);
    try {
      const [stockResp, inwardResp, issueResp] = await Promise.all([
        api.get(`/stock?from=${fromDate}&to=${toDate}`),
        api.get(`/inward?from=${fromDate}&to=${toDate}`),
        api.get(`/issue?from=${fromDate}&to=${toDate}`)
      ]);

      setStockData(stockResp.data || []);
      setInwardEntries(inwardResp.data || []);
      setIssueEntries(issueResp.data || []);

    } catch (error) {
      toast.error('Failed to fetch stock statement or transactions');
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
  };

  if (!user) return <div>Loading...</div>;

  return (
    <Layout user={user}>
      <div className="space-y-6" data-testid="stock-page">
        <div>
          <h2 className="text-2xl font-bold">Stock Statement</h2>
          <p className="text-gray-600">View current inventory stock levels</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div>
                <label className="block text-sm text-gray-600">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="mt-1 px-2 py-1 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="mt-1 px-2 py-1 border rounded"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleFetchClick}
                  disabled={!fromDate || !toDate || loading}
                  variant="default"
                  size="sm"
                >
                  {loading ? 'Loading...' : 'Fetch'}
                </Button>
                <Button onClick={handleClear} variant="outline" size="sm">
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Stock Levels</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Opening Stock</TableHead>
                  <TableHead className="text-right">Inward Qty</TableHead>
                  <TableHead className="text-right">Issue Qty</TableHead>
                  <TableHead className="text-right">Closing Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockData.map((stock) => (
                  <TableRow
                    key={stock.item_code}
                    data-testid={`stock-row-${stock.item_code}`}
                    className={stock.closing_stk < 10 ? 'bg-red-50' : ''}
                  >
                    <TableCell className="font-medium">{stock.item_code}</TableCell>
                    <TableCell>{stock.item_description}</TableCell>
                    <TableCell>{stock.category}</TableCell>
                    <TableCell className="text-right">{stock.opening_stk.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-green-600">{stock.inward_qty.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-red-600">{stock.issue_qty.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold">{stock.closing_stk.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {stockData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No stock data available for the selected range.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transactions {fromDate && toDate ? `(${fromDate} to ${toDate})` : ''}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Inward Entries</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Ref/ Supplier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inwardEntries.map((it) => (
                      <TableRow key={it.entry_id}>
                        <TableCell>{new Date(it.date).toLocaleString()}</TableCell>
                        <TableCell>{it.item_code}</TableCell>
                        <TableCell className="text-right">{it.inward_qty}</TableCell>
                        <TableCell>{it.supplier || it.ref_no}</TableCell>
                      </TableRow>
                    ))}
                    {inwardEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4 text-gray-500">No inward entries in range</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Issue Entries</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Created By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issueEntries.map((it) => (
                      <TableRow key={it.entry_id}>
                        <TableCell>{new Date(it.date).toLocaleString()}</TableCell>
                        <TableCell>{it.item_code}</TableCell>
                        <TableCell className="text-right">{it.issued_qty}</TableCell>
                        <TableCell>{it.created_by}</TableCell>
                      </TableRow>
                    ))}
                    {issueEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4 text-gray-500">No issue entries in range</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default StockPage;