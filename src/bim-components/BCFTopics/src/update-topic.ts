import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { users } from "../../../setup/users";
import * as THREE from "three";
import { appIcons, onToggleSection, showLightbox, appState } from "../../../globals";
import { Highlighter } from "../../Highlighter";
import { BCFTopics as EngineBCFTopics } from "../../../engine-components/BCFTopics";
import { Topic as EngineTopic } from "../../../engine-components/BCFTopics";
import { topicFormTemplate, TopicFormUI } from "../../../ui-components/TopicsList/src/form-template";

export const updateTopic = (bcfTopics: any) => {
  const components = bcfTopics.components as OBC.Components;
  const bcf = components.get(EngineBCFTopics);

  let currentTopic: EngineTopic | null = null;
  let onCancelHandler = () => {};
  let onUpdateHandler = () => {};

  const commentsContainer = document.createElement("div");
  commentsContainer.style.display = "flex";
  commentsContainer.style.flexDirection = "column";
  commentsContainer.style.gap = "0.5rem";
  commentsContainer.style.flex = "1";
  commentsContainer.style.minHeight = "0";
  commentsContainer.style.overflow = "hidden";
  commentsContainer.style.marginBottom = "0.5rem";
  commentsContainer.style.paddingRight = "0.5rem";

  let currentCommentPage = 0;

  // 헤더에 붙일 페이지네이션 컨테이너를 미리 생성해 둡니다.
  const paginationContainer = document.createElement("div");
  paginationContainer.style.display = "flex";
  paginationContainer.style.alignItems = "center";
  paginationContainer.style.gap = "0.5rem";

  const newCommentInput = document.createElement("bim-text-input") as BUI.TextInput;
  newCommentInput.vertical = true;
  newCommentInput.type = "area";
  newCommentInput.rows = 1;
  newCommentInput.resize = "vertical";

  // New Comment 영역을 묶고 토글 기능을 제공할 섹션 생성
  const newCommentSection = document.createElement("div");
  newCommentSection.style.display = "flex";
  newCommentSection.style.flexDirection = "column";
  newCommentSection.style.marginTop = "0.5rem";
  newCommentSection.style.flexShrink = "0";
  newCommentSection.style.border = "1px solid var(--bim-ui_bg-contrast-20)";
  newCommentSection.style.borderRadius = "4px";
  newCommentSection.style.overflow = "hidden";

  const newCommentHeader = document.createElement("div");
  newCommentHeader.style.display = "flex";
  newCommentHeader.style.justifyContent = "space-between";
  newCommentHeader.style.alignItems = "center";
  newCommentHeader.style.padding = "0.5rem";
  newCommentHeader.style.cursor = "pointer";
  newCommentHeader.style.backgroundColor = "var(--bim-ui_bg-contrast-10)";

  const newCommentLabel = document.createElement("bim-label");
  newCommentLabel.textContent = "Write a New Comment...";
  newCommentLabel.style.fontWeight = "bold";
  newCommentLabel.style.pointerEvents = "none";

  // TS 오류 수정을 위해 any로 단언하고, 전역 onToggleSection과 연동하기 위해 클래스 및 아이콘 수정
  const toggleIcon = document.createElement("bim-label") as any;
  toggleIcon.className = "toggle-icon";
  toggleIcon.icon = appIcons.RIGHT;
  toggleIcon.style.pointerEvents = "none";

  newCommentHeader.append(newCommentLabel, toggleIcon);

  const newCommentWrapper = document.createElement("div");
  newCommentWrapper.style.display = "none"; // 초기 상태는 숨김
  newCommentWrapper.style.flexDirection = "column";
  newCommentWrapper.style.gap = "0.5rem";
  newCommentWrapper.style.padding = "0.5rem";

  newCommentHeader.addEventListener("click", onToggleSection);

  const addCommentBtn = document.createElement("bim-button") as BUI.Button;
  addCommentBtn.label = "Add Comment";
  addCommentBtn.icon = appIcons.ADD;

  newCommentWrapper.append(newCommentInput, addCommentBtn);
  newCommentSection.append(newCommentHeader, newCommentWrapper);

  addCommentBtn.addEventListener("click", async () => {
    if (!currentTopic || !newCommentInput.value.trim()) return;

    addCommentBtn.loading = true;

    bcf.config.author = appState.currentUser;

    // 새 Viewpoint 생성 (카메라 및 선택된 객체 저장)
    const viewpoints = components.get(OBC.Viewpoints);
    const viewpoint = viewpoints.create();
    const worlds = components.get(OBC.Worlds);
    const world = worlds.list.values().next().value;

    if (world) {
      viewpoint.world = world;
      await viewpoint.updateCamera();

      const highlighter = components.get(Highlighter);
      const selection = highlighter.selection.select;
      if (Object.keys(selection).length > 0) {
        const fragments = components.get(OBC.FragmentsManager);
        const guids = await fragments.modelIdMapToGuids(selection);
        for (const guid of guids) {
          viewpoint.selectionComponents.add(guid);
        }
      }

      // 단면 박스(Clipping Planes) 정보 저장 (Three.js -> BCF 역변환)
      const clipper = components.get(OBC.Clipper);
      if (clipper && clipper.enabled) {
        const bcfPlanes: any[] = [];
        const planes = (clipper as any).list?.values ? Array.from((clipper as any).list.values()) : (clipper as any).elements || [];
        for (const item of planes) {
          const plane = (item as any).plane || item;
          if (plane && plane.normal && plane.constant !== undefined) {
            const point = new THREE.Vector3();
            plane.coplanarPoint(point);
            bcfPlanes.push({
              location: { x: point.x, y: -point.z, z: point.y },
              direction: { x: -plane.normal.x, y: plane.normal.z, z: -plane.normal.y }
            });
          }
        }
        if (bcfPlanes.length > 0) (viewpoint as any).clipping_planes = bcfPlanes;
      }

      currentTopic.viewpoints.add(viewpoint.guid);
    }

    let dataUrl = "";
    if (world && world.renderer) {
      world.renderer.three.render(world.scene.three, world.camera.three);
      dataUrl = world.renderer.three.domElement.toDataURL("image/png");
    }

    // 코멘트 생성 후 뷰포인트 연결
    const comment = bcfTopics.addComment(currentTopic.guid, newCommentInput.value.trim());
    if (comment && world) {
      comment.viewpoint = viewpoint.guid;
      if (dataUrl) (comment as any).snapshot = dataUrl;
    }

    newCommentInput.value = "";
    currentCommentPage = Number.MAX_SAFE_INTEGER; // 새 뷰포인트 추가 후 항상 가장 마지막 페이지로 보정됨
    renderComments(currentTopic);
    addCommentBtn.loading = false;

    // 코멘트 등록 완료 후 입력 영역을 다시 접어줌
    newCommentWrapper.style.display = "none";
    toggleIcon.icon = appIcons.RIGHT;
  });

  const getCommentSnapshotUrl = (comment: any) => {
    if (comment.snapshot) return comment.snapshot;
    if (comment.viewpoint) {
      const viewpoints = components.get(OBC.Viewpoints);
      const vp = viewpoints.list.get(comment.viewpoint);
      if (vp && vp.snapshot) {
        const snapshotData = viewpoints.snapshots.get(vp.snapshot);
        if (snapshotData) {
          const blob = new Blob([snapshotData as any], { type: "image/png" });
          const url = URL.createObjectURL(blob);
          comment.snapshot = url;
          return url;
        }
      }
    }
    return null;
  };

  const renderComments = (topic: EngineTopic) => {
    // 5. [Write a New Comment...] Author 적용
    newCommentInput.label = `${appState.currentUser} | ${new Date().toLocaleString()}`;

    commentsContainer.innerHTML = "";
    if (topic.comments.size === 0) {
      const noComments = document.createElement("bim-label");
      noComments.textContent = "No comments yet.";
      noComments.style.fontStyle = "italic";
      noComments.style.opacity = "0.7";
      commentsContainer.append(noComments);
      paginationContainer.innerHTML = "";
      return;
    }

    // 코멘트들을 시간 순으로 정렬
    const commentsArray = Array.from(topic.comments.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

    // Viewpoint 기준으로 그룹화 (Viewpoint가 없는 것은 각각 개별 그룹으로 분리)
    const groups: { viewpointGuid: string | null, comments: any[] }[] = [];
    const vpMap = new Map<string, any[]>();
    for (const comment of commentsArray) {
      if (comment.viewpoint) {
        if (!vpMap.has(comment.viewpoint)) vpMap.set(comment.viewpoint, []);
        vpMap.get(comment.viewpoint)!.push(comment);
      } else {
        groups.push({ viewpointGuid: null, comments: [comment] });
      }
    }
    for (const [vpGuid, cmts] of vpMap.entries()) {
      groups.push({ viewpointGuid: vpGuid, comments: cmts });
    }
    // 각 그룹의 가장 처음 작성된 코멘트 시간을 기준으로 그룹 정렬
    groups.sort((a, b) => a.comments[0].date.getTime() - b.comments[0].date.getTime());

    const totalPages = groups.length;
    if (currentCommentPage >= totalPages) currentCommentPage = Math.max(0, totalPages - 1);
    const currentGroup = groups[currentCommentPage];

    // 1. Viewpoint 페이지의 전체 레이아웃 컨테이너
    const pageWrapper = document.createElement("div");
    pageWrapper.style.display = "flex";
    pageWrapper.style.gap = "0.5rem";
    pageWrapper.style.height = "100%";
    pageWrapper.style.minHeight = "0";
    pageWrapper.style.overflow = "hidden";

    // 1. 고정된 스냅샷 이미지 (그룹의 첫번째 코멘트 기준)
    const firstComment = currentGroup.comments[0];
    const snapshotUrl = getCommentSnapshotUrl(firstComment);
    if (snapshotUrl) {
      const snapshotWrapper = document.createElement("div");
      snapshotWrapper.style.width = "12rem";
      snapshotWrapper.style.flexShrink = "0";
      snapshotWrapper.style.display = "flex";
      snapshotWrapper.style.flexDirection = "column";
      snapshotWrapper.style.gap = "0.5rem";
      snapshotWrapper.style.minHeight = "0";
      snapshotWrapper.style.overflowY = "auto";
      snapshotWrapper.style.overflowX = "hidden";
      snapshotWrapper.classList.add("custom-scrollbar");
      
      const img = document.createElement("img");
      img.src = snapshotUrl;
      img.style.width = "100%";
      img.style.height = "auto";
      img.style.minHeight = "0";
      img.style.boxSizing = "border-box";
      img.style.maxHeight = "100%";
      img.style.objectFit = "contain";
      img.style.borderRadius = "0.25rem";
      img.style.border = "1px solid var(--bim-ui_bg-contrast-20)";
      img.style.backgroundColor = "var(--bim-ui_bg-base, transparent)";
      img.style.cursor = "zoom-in";
      img.style.transition = "filter 0.2s";
      img.onmouseover = () => img.style.filter = "brightness(1.1)";
      img.onmouseout = () => img.style.filter = "none";
      img.addEventListener("click", () => showLightbox(snapshotUrl));

      snapshotWrapper.append(img);

      // 해당 그룹에 Viewpoint가 존재하면 복원 버튼을 스냅샷 아래에 추가
      if (currentGroup.viewpointGuid) {
        const viewBtn = document.createElement("bim-button") as BUI.Button;
        viewBtn.label = "Restore 3D View";
        viewBtn.icon = appIcons.FOCUS;
        viewBtn.style.margin = "0";
        viewBtn.style.flex = "none";
        viewBtn.style.marginBottom = "auto";
        viewBtn.style.width = "100%";
        viewBtn.style.boxSizing = "border-box";
        viewBtn.addEventListener("click", async () => {
          viewBtn.loading = true;
          await bcfTopics.restoreViewpoint(topic, { viewpointGuid: currentGroup.viewpointGuid });
          viewBtn.loading = false;
        });
        snapshotWrapper.append(viewBtn);
      }

      pageWrapper.append(snapshotWrapper);
    }

    // 2. 스크롤 가능한 코멘트 목록과 답글 폼을 담을 컨테이너
    const commentsListWrapper = document.createElement("div");
    commentsListWrapper.style.flex = "1";
    commentsListWrapper.style.minWidth = "0";
    commentsListWrapper.style.display = "flex";
    commentsListWrapper.style.flexDirection = "column";
    commentsListWrapper.style.gap = "0.5rem";
    
    const commentsScroll = document.createElement("div");
    commentsScroll.style.flex = "1";
    commentsScroll.style.minHeight = "0";
    commentsScroll.style.overflowY = "auto";
    commentsScroll.style.display = "flex";
    commentsScroll.style.flexDirection = "column";
    commentsScroll.style.gap = "0.5rem";
    commentsScroll.classList.add("custom-scrollbar");

    // 3. 각 Comment 카드 렌더링 (수정/삭제 기능 제거)
    for (const comment of currentGroup.comments) {
      const commentCard = document.createElement("div");
      commentCard.style.border = "1px solid var(--bim-ui_bg-contrast, gray)";
      commentCard.style.padding = "0.5rem";
      commentCard.style.borderRadius = "0.25rem";
      commentCard.style.backgroundColor = "var(--bim-ui_bg-base, transparent)";
      commentCard.style.display = "flex";
      commentCard.style.flexDirection = "column";
      commentCard.style.gap = "0.25rem";
      commentCard.style.flexShrink = "0";
      commentCard.style.color = "var(--bim-ui_bg-contrast-100)"; // Dark 테마 지원을 위해 텍스트 색상 적용

      const cardHeader = document.createElement("div");
      cardHeader.style.display = "flex";
      cardHeader.style.justifyContent = "space-between";
      cardHeader.style.fontSize = "0.75rem";
      cardHeader.style.opacity = "0.8";
      cardHeader.innerHTML = `<span><b>${comment.author}</b></span><span>${comment.date.toLocaleString()}</span>`;

      const cardBody = document.createElement("div");
      cardBody.textContent = comment.comment;
      cardBody.style.whiteSpace = "pre-wrap";
      cardBody.style.wordBreak = "break-word";
      cardBody.style.fontSize = "0.75rem";
      cardBody.style.lineHeight = "1.4";

      commentCard.append(cardHeader, cardBody);
      commentsScroll.append(commentCard);
    }
    
    commentsListWrapper.append(commentsScroll);

    // 4. "Add Reply" 섹션 추가 (뷰포인트가 있는 페이지에만)
    if (currentGroup.viewpointGuid) {
      const replySection = document.createElement("div");
      replySection.style.display = "flex";
      replySection.style.flexDirection = "column";
      replySection.style.gap = "0.5rem";
      replySection.style.marginTop = "auto";
      replySection.style.paddingTop = "0.5rem";
      replySection.style.borderTop = "1px dashed var(--bim-ui_bg-contrast-20)";
      replySection.style.flexShrink = "0";

      const replyInput = document.createElement("bim-text-input") as BUI.TextInput;
      replyInput.label = `${appState.currentUser} | ${new Date().toLocaleString()} (Reply)`;
      replyInput.vertical = true;
      replyInput.type = "area";
      replyInput.rows = 1;
      replyInput.resize = "vertical";

      const replyBtn = document.createElement("bim-button") as BUI.Button;
      replyBtn.label = "Add Reply to this Viewpoint";
      replyBtn.icon = appIcons.ADD;
      replyBtn.addEventListener("click", () => {
        if (!replyInput.value.trim()) return;
        replyBtn.loading = true;
        bcf.config.author = appState.currentUser;
        const newComment = bcfTopics.addComment(topic.guid, replyInput.value.trim());
        if (newComment) newComment.viewpoint = currentGroup.viewpointGuid;
        renderComments(topic);
      });

      replySection.append(replyInput, replyBtn);
      commentsScroll.append(replySection);
    }

    pageWrapper.append(commentsListWrapper);
    commentsContainer.append(pageWrapper);

    // 페이지네이션(Pagination) UI 업데이트 (헤더 영역으로 분리)
    paginationContainer.innerHTML = "";
    if (totalPages > 1) {
      const prevBtn = document.createElement("bim-button") as BUI.Button;
      prevBtn.icon = appIcons.BACK;
      prevBtn.style.margin = "0";
      prevBtn.disabled = currentCommentPage === 0;
      prevBtn.addEventListener("click", () => {
        currentCommentPage--;
        renderComments(topic);
      });

      const pageInfo = document.createElement("bim-label");
      pageInfo.textContent = `${currentCommentPage + 1} / ${totalPages}`;
      pageInfo.style.fontSize = "0.75rem";

      const nextBtn = document.createElement("bim-button") as BUI.Button;
      nextBtn.icon = appIcons.FORWARD;
      nextBtn.style.margin = "0";
      nextBtn.disabled = currentCommentPage >= totalPages - 1;
      nextBtn.addEventListener("click", () => {
        currentCommentPage++;
        renderComments(topic);
      });

      paginationContainer.append(prevBtn, pageInfo, nextBtn);
    }
  };

  // Comments UI Wrapper 생성
  const commentsWrapper = document.createElement("div");
  commentsWrapper.style.display = "flex";
  commentsWrapper.style.flexDirection = "column";
  commentsWrapper.style.height = "100%";
  commentsWrapper.style.minHeight = "0"; // 플렉스 축소를 허용하여 헤더 잘림 방지

  const commentsHeaderWrapper = document.createElement("div");
  commentsHeaderWrapper.style.display = "flex";
  commentsHeaderWrapper.style.justifyContent = "space-between";
  commentsHeaderWrapper.style.alignItems = "center";
  commentsHeaderWrapper.style.marginBottom = "0.5rem";
  commentsHeaderWrapper.style.flexShrink = "0";
  
  const commentsHeader = document.createElement("bim-label");
  commentsHeader.textContent = "Comments";
  commentsHeader.style.fontWeight = "bold";

  commentsHeaderWrapper.append(commentsHeader, paginationContainer);

  commentsWrapper.append(commentsHeaderWrapper, commentsContainer, newCommentSection);

  // 공통 폼 템플릿 컴포넌트 생성
  const [topicForm, updateTopicForm] = BUI.Component.create<HTMLDivElement, TopicFormUI>(
    topicFormTemplate,
    { components, styles: { users } }
  );

  const panel = BUI.Component.create<HTMLDivElement>(() => {
    return BUI.html`
       <div style="flex: 1; display: flex; flex-direction: column; padding: 0.5rem; box-sizing: border-box; min-height: 0;">
          ${topicForm}
       </div>
    `;
  });

  const show = (selection: Set<any>, callbacks: { onCancel: () => void, onUpdate: () => void }) => {
    onCancelHandler = callbacks.onCancel;
    onUpdateHandler = callbacks.onUpdate;

    const selectedTopics = bcfTopics.getSelectedTopics(selection);
    if (selectedTopics.length > 0) {
      currentTopic = selectedTopics[0];
      
      updateTopicForm({
        topic: currentTopic ?? undefined,
        components,
        styles: { users },
        commentsUI: commentsWrapper, // 우측에 배치될 Comments 컴포넌트 주입
        onCancel: onCancelHandler,
        onRestoreViewpoint: async () => {
          if (currentTopic) {
            await bcfTopics.restoreViewpoint(currentTopic);
          }
        },
        onSubmit: async (topic) => {
          const viewpoints = components.get(OBC.Viewpoints);
          const viewpoint = viewpoints.create();
          const worlds = components.get(OBC.Worlds);
          const world = worlds.list.values().next().value;
          if (world) {
            viewpoint.world = world;
            await viewpoint.updateCamera();
            if (world.renderer) {
              world.renderer.three.render(world.scene.three, world.camera.three);
              (topic as any).snapshot = world.renderer.three.domElement.toDataURL("image/png");
            }
          }
          const highlighter = components.get(Highlighter);
          const selection = highlighter.selection.select;
          if (Object.keys(selection).length > 0) {
            const fragments = components.get(OBC.FragmentsManager);
            const guids = await fragments.modelIdMapToGuids(selection);
            for (const guid of guids) viewpoint.selectionComponents.add(guid);
          }
          const clipper = components.get(OBC.Clipper);
          if (clipper && clipper.enabled) {
            const bcfPlanes: any[] = [];
            const planes = (clipper as any).list?.values ? Array.from((clipper as any).list.values()) : (clipper as any).elements || [];
            for (const item of planes) {
              const plane = (item as any).plane || item;
              if (plane && plane.normal && plane.constant !== undefined) {
                const point = new THREE.Vector3();
                plane.coplanarPoint(point);
                bcfPlanes.push({ location: { x: point.x, y: -point.z, z: point.y }, direction: { x: -plane.normal.x, y: plane.normal.z, z: -plane.normal.y } });
              }
            }
            if (bcfPlanes.length > 0) (viewpoint as any).clipping_planes = bcfPlanes;
          }
          topic.viewpoints.clear();
          topic.viewpoints.add(viewpoint.guid);
          await bcf.list.set(topic.guid, topic);
          onUpdateHandler();
          alert("변경사항을 공유하려면 Save BCF 버튼을 눌러 데이터베이스에 저장하십시오.");
        }
      });

      renderComments(currentTopic!);
    }
  };

  return { panel, show };
};