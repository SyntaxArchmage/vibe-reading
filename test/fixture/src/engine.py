from dataclasses import dataclass
from typing import List, Optional


@dataclass
class Config:
    batch_size: int = 32
    max_workers: int = 4
    timeout: float = 30.0


class Engine:
    def __init__(self, config: Config):
        self.config = config
        self._running = False

    def start(self) -> None:
        self._running = True
        self._initialize_workers()

    def stop(self) -> None:
        self._running = False

    def _initialize_workers(self) -> None:
        for i in range(self.config.max_workers):
            self._spawn_worker(i)

    def _spawn_worker(self, worker_id: int) -> None:
        pass

    @property
    def is_running(self) -> bool:
        return self._running


def create_engine(batch_size: int = 32) -> Engine:
    config = Config(batch_size=batch_size)
    return Engine(config)
