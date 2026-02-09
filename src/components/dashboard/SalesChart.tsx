import React from 'react';
import ReactECharts from 'echarts-for-react';
import { formatCurrency } from '../../lib/utils';

interface SalesChartProps {
  data: { date: string; value: number }[];
  loading?: boolean;
}

export default function SalesChart({ data, loading }: SalesChartProps) {
  if (loading) {
    return (
      <div className="h-[300px] w-full bg-gray-50 rounded-xl animate-pulse flex items-center justify-center text-gray-400">
        Carregando gráfico...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] w-full bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 flex-col gap-2">
        <p>Sem dados de vendas no período.</p>
      </div>
    );
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const item = params[0];
        return `
          <div class="font-medium text-gray-900 mb-1">${item.name}</div>
          <div class="text-indigo-600 font-bold">
            ${formatCurrency(item.value)}
          </div>
        `;
      },
      backgroundColor: '#fff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: {
        color: '#374151'
      },
      padding: [8, 12],
      extraCssText: 'box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border-radius: 8px;'
    },
    grid: {
      left: '2%',
      right: '2%',
      bottom: '5%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map(item => item.date),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#6b7280',
        fontSize: 12,
        margin: 12
      }
    },
    yAxis: {
      type: 'value',
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
          type: 'dashed'
        }
      },
      axisLabel: {
        color: '#6b7280',
        fontSize: 12,
        formatter: (value: number) => {
          if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
          return value;
        }
      }
    },
    series: [
      {
        name: 'Vendas',
        type: 'line',
        smooth: true,
        showSymbol: false,
        symbolSize: 8,
        itemStyle: {
          color: '#4f46e5',
          borderWidth: 2
        },
        lineStyle: {
          width: 3,
          color: '#4f46e5'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(79, 70, 229, 0.2)' },
              { offset: 1, color: 'rgba(79, 70, 229, 0)' }
            ]
          }
        },
        data: data.map(item => item.value)
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '300px', width: '100%' }} />;
}
