import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { users } from "../../../setup/users";
import * as THREE from "three";
import { appIcons, onToggleSection, showLightbox } from "../../../globals";
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
  commentsContainer.style.marginBottom = "0.5rem";
  commentsContainer.style.paddingRight = "0.5rem";

  let currentCommentPage = 0;
  const COMMENTS_PER_PAGE = 1; // 한 페이지에 보여줄 코멘트 수

  // 헤더에 붙일 페이지네이션 컨테이너를 미리 생성해 둡니다.
  const paginationContainer = document.createElement("div");
  paginationContainer.style.display = "flex";
  paginationContainer.style.alignItems = "center";
  paginationContainer.style.gap = "0.5rem";

  const newCommentInput = document.createElement("bim-text-input") as BUI.TextInput;
  newCommentInput.vertical = true;
  newCommentInput.type = "area";
  newCommentInput.rows = 2;
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
  // newCommentHeader.style.padding = "0.5rem";
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
    currentCommentPage = Math.max(0, Math.ceil(currentTopic.comments.size / COMMENTS_PER_PAGE) - 1);
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
    // 새로운 코멘트 작성란 라벨에 현재 작성자(이메일)와 현재 시각 표시
    newCommentInput.label = `${bcf.config.author} | ${new Date().toLocaleString()}`;

    commentsContainer.innerHTML = "";
    if (topic.comments.size === 0) {
      const noComments = document.createElement("bim-label");
      noComments.textContent = "No comments yet.";
      noComments.style.fontStyle = "italic";
      noComments.style.opacity = "0.7";
      commentsContainer.append(noComments);
      return;
    }

    const commentsArray = Array.from(topic.comments.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

    const totalPages = Math.ceil(commentsArray.length / COMMENTS_PER_PAGE);
    if (currentCommentPage >= totalPages) currentCommentPage = Math.max(0, totalPages - 1);

    const startIdx = currentCommentPage * COMMENTS_PER_PAGE;
    const pageComments = commentsArray.slice(startIdx, startIdx + COMMENTS_PER_PAGE);

    const commentsList = document.createElement("div");
    commentsList.style.display = "flex";
    commentsList.style.flexDirection = "column";
    commentsList.style.gap = "0.5rem";
    commentsList.style.flex = "1";
    commentsList.style.overflowY = "auto";
    commentsList.style.overflowX = "hidden";
    commentsList.classList.add("custom-scrollbar");

    for (const comment of pageComments) {
      const commentDiv = document.createElement("div");
      commentDiv.style.border = "1px solid var(--bim-ui_bg-contrast, gray)";
      commentDiv.style.padding = "0.5rem";
      commentDiv.style.borderRadius = "0.25rem";
      commentDiv.style.backgroundColor = "var(--bim-ui_bg-base, transparent)";

      const commentInput = document.createElement("bim-text-input") as BUI.TextInput;
      commentInput.label = `${comment.author} | ${comment.date.toLocaleString()}`;
      commentInput.vertical = true;
      commentInput.type = "area";
      commentInput.rows = 3;
      commentInput.resize = "vertical";
      commentInput.value = comment.comment;

      const bodyDiv = document.createElement("div");
      bodyDiv.style.display = "flex";
      bodyDiv.style.gap = "0.5rem";
      bodyDiv.style.alignItems = "stretch"; // 스냅샷과 높이 동기화

      const leftWrapper = document.createElement("div");
      leftWrapper.style.display = "flex";
      leftWrapper.style.flexDirection = "column";
      leftWrapper.style.gap = "0.5rem";
      leftWrapper.style.flex = "1";
      leftWrapper.style.minWidth = "0";

      commentInput.style.flex = "1";
      commentInput.style.minWidth = "0";

      const actions = document.createElement("div");
      actions.style.display = "grid";
      actions.style.gap = "0.25rem";
      actions.style.alignItems = "center";
      actions.style.flexShrink = "0";
      actions.style.width = "100%";

      leftWrapper.append(commentInput, actions);
      bodyDiv.append(leftWrapper);

      const snapshotUrl = getCommentSnapshotUrl(comment);
      if (snapshotUrl) {
        const img = document.createElement("img");
        img.src = snapshotUrl;
        img.style.height = "100%";
        img.style.maxHeight = "8rem";
        img.style.width = "auto";
        img.style.objectFit = "contain";
        img.style.borderRadius = "0.25rem";
        img.style.border = "1px solid var(--bim-ui_bg-contrast-20)";
        img.style.backgroundColor = "var(--bim-ui_bg-base, transparent)";
        img.style.cursor = "zoom-in";
        img.style.transition = "filter 0.2s";
        img.onmouseover = () => img.style.filter = "brightness(1.1)";
        img.onmouseout = () => img.style.filter = "none";
        img.addEventListener("click", () => showLightbox(snapshotUrl));
        bodyDiv.append(img);
      }

      const updateBtn = document.createElement("bim-button") as BUI.Button;
      updateBtn.label = "Update";
      updateBtn.style.margin = "0";
      updateBtn.style.width = "100%";
      updateBtn.addEventListener("click", () => {
        if (commentInput.value.trim()) {
          bcfTopics.updateComment(topic.guid, comment.guid, commentInput.value.trim());
          alert("Comment updated.");
        }
      });

      const deleteBtn = document.createElement("bim-button") as BUI.Button;
      deleteBtn.label = "Delete";
      deleteBtn.style.margin = "0";
      deleteBtn.style.width = "100%";
      deleteBtn.addEventListener("click", () => {
        if (confirm("Delete this comment?")) {
          bcfTopics.deleteComment(topic.guid, comment.guid);
          renderComments(topic);
        }
      });

      // 코멘트에 연결된 뷰포인트가 있다면 해당 뷰로 이동하는 버튼 추가
      if (comment.viewpoint) {
        const viewBtn = document.createElement("bim-button") as BUI.Button;
        viewBtn.label = "View";
        viewBtn.style.margin = "0";
        viewBtn.style.width = "100%";
        viewBtn.addEventListener("click", async () => {
        await bcfTopics.restoreViewpoint(topic, { viewpointGuid: comment.viewpoint });
        });
        actions.style.gridTemplateColumns = "repeat(3, 1fr)";
        actions.append(viewBtn, updateBtn, deleteBtn);
      } else {
        actions.style.gridTemplateColumns = "repeat(2, 1fr)";
        actions.append(updateBtn, deleteBtn);
      }

      commentDiv.append(bodyDiv);
      commentsList.append(commentDiv);
    }

    commentsContainer.append(commentsList);

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