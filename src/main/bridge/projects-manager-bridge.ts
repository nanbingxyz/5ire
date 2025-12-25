import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { ProjectsManager } from "@/main/services/projects-manager";

export class ProjectsManagerBridge extends Bridge.define("projects-manager", () => {
  const service = Container.inject(ProjectsManager);

  return {
    createPrompt: service.createProject.bind(service),
    deletePrompt: service.deleteProject.bind(service),
    updatePrompt: service.updateProject.bind(service),

    liveProjects: () => {
      const abort = new AbortController();

      return new ReadableStream<Awaited<ReturnType<typeof service.liveProjects>>["initialResults"]>({
        cancel: () => {
          abort.abort();
        },
        start: (controller) => {
          service
            .liveProjects()
            .then((live) => {
              if (abort.signal.aborted) {
                return;
              }

              live.refresh().catch();
              controller.enqueue(live.initialResults);

              abort.signal.addEventListener("abort", live.subscribe(controller.enqueue.bind(controller)));
            })
            .catch((error) => {
              controller.error(error);
            });
        },
      });
    },
  };
}) {}
