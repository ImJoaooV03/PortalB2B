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
      <div className="h-[300px] w-full bg-white border border-black flex items-center justify-center text-black font-bold">
        CARREGANDO...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] w-full bg-white border border-black flex items-center justify-center text-black font-bold">
        SEM DADOS
      </div>
    );
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const item = params[0];
        return `
          <div class="font-bold text-black mb-1 uppercase">${item.name}</div>
          <div class="text-black font-mono">
            ${formatCurrency(item.value)}
          </div>
        `;
      },
      backgroundColor: '#000',
      borderColor: '#000',
      borderWidth: 1,
      textStyle: {
        color: '#fff'
      },
      padding: [8, 12],
      extraCssText: 'border-radius: 0px;'
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
      axisLine: { show: true, lineStyle: { color: '#000' } },
      axisTick: { show: true, lineStyle: { color: '#000' } },
      axisLabel: {
        color: '#000',
        fontSize: 10,
        fontWeight: 'bold',
        margin: 12
      }
    },
    yAxis: {
      type: 'value',
      splitLine: {
        lineStyle: {
          color: '#e5e5e5',
          type: 'dashed'
        }
      },
      axisLabel: {
        color: '#000',
        fontSize: 10,
        fontWeight: 'bold',
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
        smooth: false, // Sharp lines for brutalist look
        showSymbol: true,
        symbol: 'rect',
        symbolSize: 6,
        itemStyle: {
          color: '#000',
          borderWidth: 2,
          borderColor: '#fff'
        },
        lineStyle: {
          width: 2,
          color: '#000'
        },
        areaStyle: {
          color: '#000',
          opacity: 0.1
        },
        data: data.map(item => item.value)
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '300px', width: '100%' }} />;
}
