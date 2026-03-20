import * as BUI from "@thatopen/ui";
import { Chart, registerables } from "chart.js";
import { BoxPlotController, BoxAndWiskers } from "@sgratzl/chartjs-chart-boxplot";
export * from "./src/chart";

// Chart.js의 모든 요소를 등록합니다.
Chart.register(...registerables, BoxPlotController, BoxAndWiskers);

// 컴포넌트의 상태를 정의합니다.
export interface QuantityChartState {
  elementData: any[]; // propsTable.downloadData()의 결과 JSON
}

// 데이터를 집계하는 핵심 로직 (합계가 아닌 Boxplot을 위한 Raw Array 데이터 수집)
const processData = (elementData: any[]) => {
  const rawData: Record<string, Record<string, { guid: string; objectType: string; predefinedType: string; value: number }[]>> = {};

  const findAndProcessQuantities = (item: any, category: string, guid: string, objectType: string, predefinedType: string) => {
    if (!item.children) return;
    for (const child of item.children) {
      if (typeof child.data.Name === "string" && (child.data.Name.includes("Quantities") || child.data.Name.startsWith("Qto_"))) {
        if (!child.children) continue;
        for (const quantity of child.children) {
          const name = quantity.data.Name as string;
          const value = quantity.data.Value;
          if (typeof value === "number") {
            rawData[category] = rawData[category] || {};
            rawData[category][name] = rawData[category][name] || [];
            rawData[category][name].push({ guid, objectType, predefinedType, value });
          }
        }
      }
    }
  };

  for (const item of elementData) {
    const categoryChild = item.children?.find((c: any) => c.data.Name === "Category");
    if (categoryChild) {
      const category = categoryChild.data.Value;
      
      let guid = item.data.guid;
      let objectType = "";
      let predefinedType = "";
      if (!guid && item.children) {
        const guidChild = item.children.find((c: any) => c.data.Name === "Guid");
        if (guidChild) guid = guidChild.data.Value;
        
        const otChild = item.children.find((c: any) => c.data.Name === "ObjectType");
        if (otChild) objectType = String(otChild.data.Value || "");
        
        const ptChild = item.children.find((c: any) => c.data.Name === "PredefinedType");
        if (ptChild) predefinedType = String(ptChild.data.Value || "");
      }
      findAndProcessQuantities(item, category, String(guid), objectType, predefinedType);
    }
  }
  return rawData;
};

// 차트 컴포넌트 템플릿
export const quantityChartTemplate: BUI.StatefullComponent<QuantityChartState> = (
  state,
) => {
  const rawData = processData(state.elementData);
  console.log("[QuantityChart] Processed Raw Data for Boxplot:", rawData);

  const quantitiesSet = new Set<string>();
  Object.values(rawData).forEach(catData => {
    Object.keys(catData).forEach(q => quantitiesSet.add(q));
  });
  const allQuantities = Array.from(quantitiesSet);
  const allCategories = Object.keys(rawData);

  // 선택된 카테고리를 추적 (기본값: 모두 선택)
  const selectedCategories = new Set(allCategories);
  // 선택된 Quantity를 추적 (기본값: 모두 선택)
  const selectedQuantities = new Set(allQuantities);

  let canvas: HTMLCanvasElement | undefined;

  const updateChartDisplay = () => {
    if (!canvas) return;
    const chartInstance = (canvas as any).chartInstance as Chart | undefined;
    if (!chartInstance) return;

    const visibleQuantities = allQuantities.filter(q => selectedQuantities.has(q));
    chartInstance.data.labels = visibleQuantities;

    const datasets: any[] = [];
    let colorIndex = 0;
    const colors = [
      "rgba(54, 162, 235, 0.8)",
      "rgba(255, 99, 132, 0.8)",
      "rgba(75, 192, 192, 0.8)",
      "rgba(255, 205, 86, 0.8)",
      "rgba(153, 102, 255, 0.8)",
      "rgba(255, 159, 64, 0.8)"
    ];

    for (const cat of allCategories) {
      if (!selectedCategories.has(cat)) continue;

      const color = colors[colorIndex % colors.length];
      colorIndex++;

      const data = visibleQuantities.map(q => {
        const vals = rawData[cat][q];
        // Boxplot 플러그인은 값(number) 배열을 받으므로 객체에서 value만 추출합니다.
        return vals && vals.length > 0 ? vals.map(v => v.value) : [];
      });

      datasets.push({
        label: cat,
        data: data,
        backgroundColor: color,
        borderColor: color.replace("0.8", "1"),
        borderWidth: 1,
        outlierBackgroundColor: color,
        meanBackgroundColor: "black",
        meanBorderColor: "black",
        barPercentage: 0.4,
      });
    }

    chartInstance.data.datasets = datasets;
    chartInstance.update();
  };

  const downloadCSV = () => {
    const visibleQuantities = allQuantities.filter(q => selectedQuantities.has(q));
    
    // 가로로 나열되던 원본 데이터를 세로(Transpose/Long format)로 나열하기 위해 헤더를 고정합니다.
    const headers = ["Category", "Guid", "ObjectType", "PredefinedType", "Quantity", "Sum", "Mean", "Min", "Max", "Median", "Value"];
    const lines = [headers.join(",")];

    for (const cat of allCategories) {
      if (!selectedCategories.has(cat)) continue;
      for (const q of visibleQuantities) {
        const rawItems = rawData[cat][q];
        if (rawItems && rawItems.length > 0) {
          const rawVals = rawItems.map(item => item.value);
          const sorted = [...rawVals].sort((a, b) => a - b);
          const sum = sorted.reduce((a, b) => a + b, 0);
          const mean = sum / sorted.length;
          const min = sorted[0];
          const max = sorted[sorted.length - 1];
          const mid = Math.floor(sorted.length / 2);
          const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
          
          // 카테고리나 수량 이름에 쉼표가 있을 경우 CSV 깨짐 방지를 위해 따옴표로 감싸기
          const safeCat = cat.includes(",") ? `"${cat}"` : cat;
          const safeQ = q.includes(",") ? `"${q}"` : q;
          
          // 객체별 식별자(Guid)와 수량값(Value)을 세로로 한 줄씩 추가합니다.
          for (const item of rawItems) {
            const safeGuid = String(item.guid).includes(",") ? `"${item.guid}"` : String(item.guid);
            const safeObjectType = item.objectType.includes(",") ? `"${item.objectType}"` : item.objectType;
            const safePredefinedType = item.predefinedType.includes(",") ? `"${item.predefinedType}"` : item.predefinedType;
            const row = [
              safeCat,
              safeGuid,
              safeObjectType,
              safePredefinedType,
              safeQ,
              sum.toFixed(2),
              mean.toFixed(2),
              min.toFixed(2),
              max.toFixed(2),
              median.toFixed(2),
              item.value
            ];
            lines.push(row.join(","));
          }
        }
      }
    }

    const csvContent = "\uFEFF" + lines.join("\n"); // 엑셀에서 한글 깨짐 방지를 위한 BOM 추가
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "quantity_chart_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPNG = () => {
    if (!canvas) return;
    
    // 투명 배경을 방지하기 위해 Chart.js 내부 API 대신 배경이 흰 캔버스를 생성해 이미지를 추출합니다.
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    ctx.drawImage(canvas, 0, 0);
    
    const url = tempCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "quantity_chart.png");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 각종 통계 수치를 표시하는 커스텀 플러그인
  const statsLabelPlugin = {
    id: 'statsLabelPlugin',
    afterDatasetsDraw(chart: Chart) {
      const { ctx, scales: { y } } = chart;
      ctx.save();
      ctx.font = '12px sans-serif';

      chart.data.datasets.forEach((dataset, i) => {
        const meta = chart.getDatasetMeta(i);
        if (!meta.hidden) {
          meta.data.forEach((element: any, index: number) => {
            const rawVals = dataset.data[index] as number[];
            if (rawVals && rawVals.length > 0) {
              const sorted = [...rawVals].sort((a, b) => a - b);
              const sum = sorted.reduce((a, b) => a + b, 0);
              const mean = sum / sorted.length;
              const min = sorted[0];
              const max = sorted[sorted.length - 1];
              const mid = Math.floor(sorted.length / 2);
              const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

              // 얇아진 막대의 우측 경계선을 기준으로 여백(4px)을 추가
              const rightX = element.x + (element.width / 2) + 4;
              const topY = y.getPixelForValue(max);
              
              ctx.fillStyle = dataset.borderColor as string;
              
              // 총합은 Box 위쪽 중앙에 배치
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(`Σ: ${sum.toFixed(1)}`, element.x, topY - 10); // 폰트가 커졌으므로 위쪽 여백도 약간 늘림
              
              // 평균, 중앙값, 최대값, 최소값은 Box의 우측에 배치
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(`Max: ${max.toFixed(1)}`, rightX, y.getPixelForValue(max));
              ctx.fillText(`Min: ${min.toFixed(1)}`, rightX, y.getPixelForValue(min));
              ctx.fillText(`Mean: ${mean.toFixed(1)}`, rightX, y.getPixelForValue(mean));
              ctx.fillText(`Med: ${median.toFixed(1)}`, rightX, y.getPixelForValue(median));
            }
          });
        }
      });
      ctx.restore();
    }
  };

  const onCanvasRef = (e?: Element) => {
    if (!e) return;
    canvas = e as HTMLCanvasElement;
    let chartInstance = (canvas as any).chartInstance as Chart | undefined;

    if (!chartInstance) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      chartInstance = new Chart(ctx, {
        type: "boxplot", // Box and Whisker Plot
        plugins: [statsLabelPlugin],
        data: {
          labels: [],
          datasets: [],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: {
              top: 25,
            },
          },
          scales: {
            y: {
              beginAtZero: false,
            },
          },
          plugins: {
            legend: {
              display: false, // 커스텀 체크박스 범례를 사용하므로 숨김
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const raw = context.raw as any;
                  if (raw && typeof raw.min === 'number') {
                    return `${context.dataset.label} - Min: ${raw.min.toFixed(2)}, Max: ${raw.max.toFixed(2)}, Mean: ${raw.mean.toFixed(2)}`;
                  }
                  return context.dataset.label || '';
                }
              }
            }
          }
        },
      });
      (canvas as any).chartInstance = chartInstance;
    }

    setTimeout(() => {
      updateChartDisplay();
    }, 0);
  };

  return BUI.html`
    <div style="display: flex; flex-direction: column; gap: 1rem; height: 100%; min-height: 400px; padding: 1rem; box-sizing: border-box; overflow-y: auto;">
      <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
        <bim-button label="Export CSV" @click=${downloadCSV}></bim-button>
        <bim-button label="Export PNG" @click=${downloadPNG}></bim-button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <bim-label>Categories:</bim-label>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${allCategories.map(cat => BUI.html`
              <bim-checkbox checked label=${cat} @change=${(e: Event) => {
                const target = e.target as any;
                if (target.checked) selectedCategories.add(cat);
                else selectedCategories.delete(cat);
                updateChartDisplay();
              }}></bim-checkbox>
            `)}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <bim-label>Quantities:</bim-label>
          <bim-dropdown multiple @change=${(e: Event) => {
            const target = e.target as any;
            selectedQuantities.clear();
            if (Array.isArray(target.value)) {
              target.value.forEach((v: any) => {
                if (typeof v === "string") selectedQuantities.add(v);
              });
            }
            updateChartDisplay();
          }}>
            ${allQuantities.map(q => BUI.html`<bim-option checked .value=${q} .label=${q}></bim-option>`)}
          </bim-dropdown>
        </div>
      </div>
      <div style="position: relative; flex: 1; min-height: 300px;">
        <canvas ${BUI.ref(onCanvasRef)}></canvas>
      </div>
    </div>
  `;
};