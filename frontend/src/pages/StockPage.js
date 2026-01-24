import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/utils/api';
import { toast } from 'sonner';

const StockPage = () => {
  const [user, setUser] = useState(null);
  const [stockData, setStockData] = useState([]);

  useEffect(() => {
    fetchUser();
    fetchStock();
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
    try {
      const response = await api.get('/stock');
      setStockData(response.data);
    } catch (error) {
      toast.error('Failed to fetch stock statement');
    }
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
                      No stock data available. Add items and transactions to see stock levels.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default StockPage;