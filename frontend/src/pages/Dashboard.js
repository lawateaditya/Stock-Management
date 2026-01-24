import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import api from '@/utils/api';
import { toast } from 'sonner';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalInward: 0,
    totalIssue: 0,
    lowStock: 0,
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('/auth/me');
        setUser(response.data);
      } catch (error) {
        toast.error('Failed to fetch user data');
      }
    };

    const fetchStats = async () => {
      try {
        const promises = [];
        
        // Always try to fetch items
        promises.push(api.get('/items').catch(() => ({ data: [] })));
        
        // Fetch inward/issue based on role
        promises.push(api.get('/inward').catch(() => ({ data: [] })));
        promises.push(api.get('/issue').catch(() => ({ data: [] })));

        const [itemsRes, inwardRes, issueRes] = await Promise.all(promises);

        setStats({
          totalItems: itemsRes.data.length,
          totalInward: inwardRes.data.reduce((sum, entry) => sum + entry.inward_qty, 0),
          totalIssue: issueRes.data.reduce((sum, entry) => sum + entry.issued_qty, 0),
          lowStock: 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchUser();
    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total Items',
      value: stats.totalItems,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Total Inward',
      value: stats.totalInward.toFixed(2),
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Total Issue',
      value: stats.totalIssue.toFixed(2),
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'Current Stock',
      value: (stats.totalInward - stats.totalIssue).toFixed(2),
      icon: BarChart3,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <Layout user={user}>
      <div className="space-y-6" data-testid="dashboard">
        {/* Welcome Section */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-gray-800" style={{ fontFamily: 'Manrope' }}>
            Welcome back, {user.name}!
          </h1>
          <p className="text-gray-600 mt-1">Here's what's happening with your inventory today</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="card-hover" data-testid={`stat-card-${stat.title.toLowerCase().replace(' ', '-')}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {user.role === 'admin' && (
                <div className="p-4 border rounded-lg hover:shadow-md transition cursor-pointer" data-testid="quick-action-add-item">
                  <Package className="h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-semibold">Add New Item</h3>
                  <p className="text-sm text-gray-600">Create a new item in inventory</p>
                </div>
              )}
              {['admin', 'inward_user'].includes(user.role) && (
                <div className="p-4 border rounded-lg hover:shadow-md transition cursor-pointer" data-testid="quick-action-inward">
                  <TrendingUp className="h-8 w-8 text-green-600 mb-2" />
                  <h3 className="font-semibold">Record Inward</h3>
                  <p className="text-sm text-gray-600">Add stock to inventory</p>
                </div>
              )}
              {['admin', 'issuer_user'].includes(user.role) && (
                <div className="p-4 border rounded-lg hover:shadow-md transition cursor-pointer" data-testid="quick-action-issue">
                  <TrendingDown className="h-8 w-8 text-red-600 mb-2" />
                  <h3 className="font-semibold">Issue Items</h3>
                  <p className="text-sm text-gray-600">Issue stock from inventory</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;